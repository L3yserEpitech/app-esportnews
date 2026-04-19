# Apple App Review Fixes (5.1.1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 4 Apple App Store rejection issues (Guideline 5.1.1) so the app passes review.

**Architecture:** 4 independent fixes: (1) make age optional in registration, (2) remove auth guard from IAP purchase flow, (3) add missing iOS permission strings, (4) implement full account deletion flow (backend + frontend).

**Tech Stack:** React Native (Expo), Go (Echo), GORM, react-native-iap, Expo ImagePicker

---

## File Structure

| Task | Action | File |
|------|--------|------|
| 1 | Modify | `mobile-app/app/auth/register.tsx` |
| 2 | Modify | `mobile-app/app/profile/subscription.tsx` |
| 3 | Modify | `mobile-app/app.config.js` |
| 4 | Modify | `backend-go/internal/handlers/auth.go` |
| 4 | Modify | `backend-go/internal/services/auth_service.go` |
| 4 | Modify | `backend-go/internal/models/user.go` |
| 4 | Modify | `mobile-app/services/authService.ts` |
| 4 | Modify | `mobile-app/app/profile/security.tsx` |

---

### Task 1: Make Age Optional in Registration

**Files:**
- Modify: `mobile-app/app/auth/register.tsx:44,49-53,83,194-210`

The backend already accepts age as optional (`*int` with `validate:"omitempty"`). Only the frontend forces it.

- [ ] **Step 1: Remove age from required validation**

In `mobile-app/app/auth/register.tsx`, change line 44 from:
```typescript
if (!name || !email || !age || !password || !confirmPassword) {
```
to:
```typescript
if (!name || !email || !password || !confirmPassword) {
```

- [ ] **Step 2: Make age validation conditional**

Change lines 49-53 from:
```typescript
const ageNum = parseInt(age);
if (isNaN(ageNum) || ageNum < 13 || ageNum > 120) {
  setError('Veuillez entrer un âge valide (minimum 13 ans)');
  return;
}
```
to:
```typescript
let ageNum: number | undefined;
if (age.trim()) {
  ageNum = parseInt(age);
  if (isNaN(ageNum) || ageNum < 13 || ageNum > 120) {
    setError('Veuillez entrer un âge valide (minimum 13 ans)');
    return;
  }
}
```

- [ ] **Step 3: Send age as optional in register call**

Change line 78-84 from:
```typescript
await register({
  name: name.trim(),
  email: email.trim().toLowerCase(),
  password,
  age: ageNum,
});
```
to:
```typescript
await register({
  name: name.trim(),
  email: email.trim().toLowerCase(),
  password,
  ...(ageNum !== undefined && { age: ageNum }),
});
```

- [ ] **Step 4: Add "(Optionnel)" label to age input**

Change line 195 from:
```tsx
<Text style={styles.inputLabel}>Âge</Text>
```
to:
```tsx
<Text style={styles.inputLabel}>Âge <Text style={{ color: COLORS.textMuted, fontWeight: '400' }}>(Optionnel)</Text></Text>
```

- [ ] **Step 5: Commit**

```bash
cd mobile-app
git add app/auth/register.tsx
git commit -m "fix(mobile): make age field optional in registration (Apple 5.1.1v)"
```

---

### Task 2: Remove Auth Guard from IAP Purchase Flow

**Files:**
- Modify: `mobile-app/app/profile/subscription.tsx`

The subscription screen at `app/profile/subscription.tsx` already has NO auth check before purchase (confirmed by reading the code). The `useSubscription` hook also has no auth guard. The `subscribe()` function calls `requestPurchase()` directly.

However, the profile tab (`app/(tabs)/profile.tsx`) only shows the "Abonnement Premium" link when `isAuthenticated` is true (line 183-253). Non-authenticated users cannot reach the subscription page.

Apple requires: users must be able to purchase IAP without creating an account.

- [ ] **Step 1: Add Premium subscription link for non-authenticated users**

In `mobile-app/app/(tabs)/profile.tsx`, find the non-authenticated section (lines 234-253):
```tsx
) : (
  <Section title="Général">
    <ProfileItem
      icon="log-in-outline"
      title="Se connecter"
      subtitle="Accéder à votre espace personnel"
      onPress={() => router.push('/auth/login')}
      iconBg="rgba(48, 209, 88, 0.15)"
      color="#30D158"
    />
    <View style={styles.divider} />
    <ProfileItem
      icon="person-add-outline"
      title="Créer un compte"
      subtitle="Rejoindre la communauté Esport News"
      onPress={() => router.push('/auth/register')}
      iconBg="rgba(10, 132, 255, 0.15)"
      color="#0A84FF"
    />
  </Section>
)}
```

Replace with:
```tsx
) : (
  <>
    <Section title="Premium">
      <ProfileItem
        icon="star-outline"
        title="Abonnement Premium"
        subtitle="Zéro pub, soutenez l'app"
        onPress={() => router.push('/profile/subscription' as any)}
        iconBg="rgba(242, 46, 98, 0.15)"
        color={COLORS.primary}
      />
    </Section>

    <Section title="Général">
      <ProfileItem
        icon="log-in-outline"
        title="Se connecter"
        subtitle="Accéder à votre espace personnel"
        onPress={() => router.push('/auth/login')}
        iconBg="rgba(48, 209, 88, 0.15)"
        color="#30D158"
      />
      <View style={styles.divider} />
      <ProfileItem
        icon="person-add-outline"
        title="Créer un compte"
        subtitle="Rejoindre la communauté Esport News"
        onPress={() => router.push('/auth/register')}
        iconBg="rgba(10, 132, 255, 0.15)"
        color="#0A84FF"
      />
    </Section>
  </>
)}
```

- [ ] **Step 2: Verify subscription screen has no auth check**

Open `mobile-app/app/profile/subscription.tsx` and confirm there is NO `isAuthenticated` check or redirect. Currently confirmed: no auth guard present. No changes needed here.

- [ ] **Step 3: Commit**

```bash
cd mobile-app
git add app/(tabs)/profile.tsx
git commit -m "fix(mobile): allow IAP purchase without account (Apple 5.1.1v)"
```

---

### Task 3: Add Missing iOS Permission Strings

**Files:**
- Modify: `mobile-app/app.config.js:23-78` (ios.infoPlist section)

Camera and photo library are used in `app/profile/edit.tsx` for avatar upload. The permission strings are currently missing from `app.config.js`.

- [ ] **Step 1: Add NSCameraUsageDescription and NSPhotoLibraryUsageDescription**

In `mobile-app/app.config.js`, inside the `ios.infoPlist` object (after line 77, the `NSUserTrackingUsageDescription` line), add:

```javascript
NSUserTrackingUsageDescription: "Cette application utilise le suivi publicitaire pour vous montrer des publicités personnalisées.",
NSCameraUsageDescription: "Esport News a besoin d'accéder à votre appareil photo pour vous permettre de prendre une photo de profil. Cette photo sera utilisée comme avatar sur votre compte.",
NSPhotoLibraryUsageDescription: "Esport News a besoin d'accéder à votre galerie photos pour vous permettre de choisir une photo de profil. Cette photo sera utilisée comme avatar sur votre compte."
```

Note: the existing `NSUserTrackingUsageDescription` line needs a comma added at the end before the two new entries.

- [ ] **Step 2: Commit**

```bash
cd mobile-app
git add app.config.js
git commit -m "fix(mobile): add camera and photo library permission strings (Apple 5.1.1ii)"
```

---

### Task 4: Implement Account Deletion Flow

This is the largest task. It requires: backend endpoint, service method, frontend service method, and UI.

#### Step 4a: Backend — Add DeleteAccount model

**Files:**
- Modify: `backend-go/internal/models/user.go`

- [ ] **Step 1: Add DeleteAccountInput struct**

In `backend-go/internal/models/user.go`, after the `ChangePasswordInput` struct (line 173), add:

```go
type DeleteAccountInput struct {
	Password string `json:"password" validate:"required"`
}
```

- [ ] **Step 2: Commit**

```bash
cd backend-go
git add internal/models/user.go
git commit -m "feat(backend): add DeleteAccountInput model"
```

#### Step 4b: Backend — Add DeleteAccount service method

**Files:**
- Modify: `backend-go/internal/services/auth_service.go`

- [ ] **Step 3: Add DeleteAccount method to AuthService**

At the end of `backend-go/internal/services/auth_service.go` (before the closing of the file), add:

```go
// DeleteAccount permanently deletes a user account after password verification
func (s *AuthService) DeleteAccount(ctx context.Context, userID int64, password string) error {
	// Use GORM if available
	if s.gormDB != nil {
		var user models.User
		if err := s.gormDB.WithContext(ctx).First(&user, userID).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return fmt.Errorf("user not found")
			}
			return fmt.Errorf("failed to query user: %w", err)
		}

		// Verify password
		if err := utils.VerifyPassword(user.Password, password); err != nil {
			return fmt.Errorf("incorrect password")
		}

		// Delete user (hard delete)
		if err := s.gormDB.WithContext(ctx).Unscoped().Delete(&models.User{}, userID).Error; err != nil {
			return fmt.Errorf("failed to delete user: %w", err)
		}

		// Clear cached tokens
		cacheCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		s.Cache.Del(cacheCtx, cache.RefreshTokenKey(userID))

		return nil
	}

	// Fallback to pgxpool
	var currentHashedPassword string
	err := s.db.QueryRow(ctx,
		`SELECT password FROM public.users WHERE id = $1`,
		userID,
	).Scan(&currentHashedPassword)

	if err != nil {
		return fmt.Errorf("user not found")
	}

	// Verify password
	if err := utils.VerifyPassword(currentHashedPassword, password); err != nil {
		return fmt.Errorf("incorrect password")
	}

	// Delete user
	_, err = s.db.Exec(ctx,
		`DELETE FROM public.users WHERE id = $1`,
		userID,
	)

	if err != nil {
		return fmt.Errorf("failed to delete user: %w", err)
	}

	// Clear cached tokens
	cacheCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	s.Cache.Del(cacheCtx, cache.RefreshTokenKey(userID))

	return nil
}
```

- [ ] **Step 4: Commit**

```bash
cd backend-go
git add internal/services/auth_service.go
git commit -m "feat(backend): add DeleteAccount service method with password verification"
```

#### Step 4c: Backend — Add DELETE /auth/account endpoint

**Files:**
- Modify: `backend-go/internal/handlers/auth.go`

- [ ] **Step 5: Register the route**

In `backend-go/internal/handlers/auth.go`, inside the `RegisterRoutes` function (after line 33 `g.POST("/auth/refresh", h.RefreshToken)`), add:

```go
g.DELETE("/auth/account", h.DeleteAccount)
```

- [ ] **Step 6: Add the handler method**

In `backend-go/internal/handlers/auth.go`, before the `// Helper functions` comment (line 307), add:

```go
func (h *AuthHandler) DeleteAccount(c echo.Context) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	userID, err := h.extractUserID(c)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "Invalid token")
	}

	var input models.DeleteAccountInput
	if err := c.Bind(&input); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request")
	}

	if input.Password == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "Password is required")
	}

	if err := h.authService.DeleteAccount(ctx, userID, input.Password); err != nil {
		if err.Error() == "incorrect password" {
			return echo.NewHTTPError(http.StatusUnauthorized, "Incorrect password")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "Account deleted successfully"})
}
```

- [ ] **Step 7: Commit**

```bash
cd backend-go
git add internal/handlers/auth.go
git commit -m "feat(backend): add DELETE /auth/account endpoint"
```

#### Step 4d: Frontend — Add deleteAccount to authService

**Files:**
- Modify: `mobile-app/services/authService.ts`

- [ ] **Step 8: Add deleteAccount method**

In `mobile-app/services/authService.ts`, before the closing `}` of the `AuthService` class (before line 153), add:

```typescript
  /**
   * Suppression définitive du compte utilisateur
   */
  async deleteAccount(password: string): Promise<void> {
    try {
      await apiClient.delete('/api/auth/account', {
        data: { password },
      });
      await this.removeToken();
    } catch (error: any) {
      const message = error.response?.data?.message || error.response?.data?.error || 'Impossible de supprimer le compte';
      throw new Error(message);
    }
  }
```

- [ ] **Step 9: Commit**

```bash
cd mobile-app
git add services/authService.ts
git commit -m "feat(mobile): add deleteAccount method to authService"
```

#### Step 4e: Frontend — Add delete account UI to security screen

**Files:**
- Modify: `mobile-app/app/profile/security.tsx`

- [ ] **Step 10: Add state for delete flow**

In `mobile-app/app/profile/security.tsx`, after line 36 (`const [isLoading, setIsLoading] = useState(false);`), add:

```typescript
const [deletePassword, setDeletePassword] = useState('');
const [showDeletePassword, setShowDeletePassword] = useState(false);
const [isDeleting, setIsDeleting] = useState(false);
```

- [ ] **Step 11: Add handleDeleteAccount function**

After the `handleChangePassword` function (after line 74), add:

```typescript
const handleDeleteAccount = () => {
  if (!deletePassword.trim()) {
    Alert.alert('Erreur', 'Veuillez entrer votre mot de passe pour confirmer la suppression');
    return;
  }

  Alert.alert(
    'Supprimer mon compte',
    'Cette action est irréversible. Toutes vos données seront définitivement supprimées. Êtes-vous sûr ?',
    [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer définitivement',
        style: 'destructive',
        onPress: async () => {
          try {
            setIsDeleting(true);
            await authService.deleteAccount(deletePassword);
            Alert.alert(
              'Compte supprimé',
              'Votre compte a été supprimé avec succès.',
              [{ text: 'OK', onPress: () => router.replace('/(tabs)') }]
            );
          } catch (error: any) {
            Alert.alert('Erreur', error.message || 'Impossible de supprimer le compte');
          } finally {
            setIsDeleting(false);
          }
        },
      },
    ]
  );
};
```

- [ ] **Step 12: Add delete account UI section**

In `mobile-app/app/profile/security.tsx`, after the cancel button (`</TouchableOpacity>` at line 223), before `<View style={{ height: 40 }} />`, add:

```tsx
{/* Delete Account Section */}
<View style={styles.section}>
  <Text style={[styles.sectionLabel, { color: '#FF453A' }]}>Zone de danger</Text>
  <BlurView intensity={10} tint="light" style={[styles.glassCard, { borderColor: 'rgba(255, 69, 58, 0.2)' }]}>
    <View style={styles.inputWrapper}>
      <Text style={styles.inputLabel}>Confirmez votre mot de passe</Text>
      <TextInput
        value={deletePassword}
        onChangeText={setDeletePassword}
        mode="flat"
        placeholder="Entrez votre mot de passe"
        placeholderTextColor={COLORS.textMuted}
        secureTextEntry={!showDeletePassword}
        textColor={COLORS.text}
        style={styles.input}
        underlineColor="transparent"
        activeUnderlineColor="#FF453A"
        left={<TextInput.Icon icon="lock-outline" color={COLORS.textMuted} />}
        right={
          <TextInput.Icon
            icon={showDeletePassword ? 'eye-off' : 'eye'}
            color={COLORS.textMuted}
            onPress={() => setShowDeletePassword(!showDeletePassword)}
          />
        }
      />
    </View>
  </BlurView>
</View>

<TouchableOpacity
  onPress={handleDeleteAccount}
  disabled={isDeleting || !deletePassword}
  activeOpacity={0.8}
  style={{ marginBottom: spacing.md }}
>
  <View style={[styles.deleteButton, (isDeleting || !deletePassword) && { opacity: 0.5 }]}>
    {isDeleting ? (
      <ActivityIndicator color="#FF453A" />
    ) : (
      <>
        <Ionicons name="trash-outline" size={20} color="#FF453A" />
        <Text style={styles.deleteButtonText}>Supprimer mon compte</Text>
      </>
    )}
  </View>
</TouchableOpacity>
```

- [ ] **Step 13: Add styles for delete button**

In `mobile-app/app/profile/security.tsx`, inside the `StyleSheet.create` block, add these styles (after `cancelButtonText`):

```typescript
deleteButton: {
  height: 56,
  borderRadius: borderRadius.xl,
  flexDirection: 'row',
  justifyContent: 'center',
  alignItems: 'center',
  gap: spacing.sm,
  backgroundColor: 'rgba(255, 69, 58, 0.1)',
  borderWidth: 1,
  borderColor: 'rgba(255, 69, 58, 0.3)',
},
deleteButtonText: {
  color: '#FF453A',
  fontSize: 16,
  fontWeight: 'bold',
},
```

- [ ] **Step 14: Commit**

```bash
cd mobile-app
git add app/profile/security.tsx
git commit -m "feat(mobile): add account deletion flow in security screen (Apple 5.1.1v)"
```

---

### Task 5: Final Verification & Build

- [ ] **Step 1: Verify backend compiles**

```bash
cd backend-go
go build ./...
```
Expected: no errors.

- [ ] **Step 2: Verify mobile app compiles**

```bash
cd mobile-app
npx expo export --platform ios 2>&1 | tail -5
```
Expected: no TypeScript errors.

- [ ] **Step 3: Final commit with all changes**

```bash
git add -A
git commit -m "fix: address Apple App Review rejections (5.1.1) - age optional, IAP without account, permission strings, account deletion"
```

- [ ] **Step 4: Build and submit**

```bash
cd mobile-app
npx eas-cli build --profile production --platform ios --auto-submit
```
