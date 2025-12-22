import React from 'react';
import { View, StyleSheet, Dimensions, Platform } from 'react-native';
import { Portal, Modal, Button, IconButton, Text } from 'react-native-paper';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { 
  FadeInDown, 
  FadeOutDown 
} from 'react-native-reanimated';
import { COLORS } from '@/constants/colors';
import { spacing, borderRadius } from '@/constants/theme';

const { width } = Dimensions.get('window');

interface LoginPromptModalProps {
  visible: boolean;
  onClose: () => void;
  onLogin: () => void;
  onRegister: () => void;
}

export const LoginPromptModal: React.FC<LoginPromptModalProps> = ({
  visible,
  onClose,
  onLogin,
  onRegister,
}) => {
  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onClose}
        contentContainerStyle={styles.modalContainer}
      >
        <Animated.View 
          entering={FadeInDown.duration(400)}
          exiting={FadeOutDown.duration(300)}
          style={styles.modalContentWrapper}
        >
          {Platform.OS === 'ios' && (
            <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
          )}
          
          <View style={[
            styles.modalInner, 
            { backgroundColor: Platform.OS === 'ios' ? 'rgba(9, 22, 38, 0.85)' : COLORS.surface }
          ]}>
            <IconButton
              icon="close"
              size={24}
              onPress={onClose}
              style={styles.closeButton}
              iconColor={COLORS.textSecondary}
            />

            <View style={styles.headerSection}>
              <Image 
                source={require('@/assets/logo_blanc.png')} 
                style={styles.logo} 
                contentFit="contain" 
              />
              
              <Text variant="headlineSmall" style={styles.modalTitle}>
                Bienvenue sur Esport News
              </Text>
              
              <Text variant="bodyMedium" style={styles.modalDescription}>
                Connectez-vous pour profiter de toutes les fonctionnalités et ne rien manquer de l'actualité esport.
              </Text>
            </View>

            <View style={styles.actions}>
              <LinearGradient
                colors={[COLORS.primary, '#C2185B']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.loginButtonGradient}
              >
                <Button
                  mode="text"
                  onPress={onLogin}
                  style={styles.loginButton}
                  labelStyle={styles.loginButtonLabel}
                >
                  Se connecter
                </Button>
              </LinearGradient>

              <Button
                mode="outlined"
                onPress={onRegister}
                style={styles.registerButton}
                textColor={COLORS.text}
                contentStyle={styles.buttonContent}
              >
                Créer un compte
              </Button>

              <Button
                mode="text"
                onPress={onClose}
                style={styles.skipButton}
                textColor={COLORS.textMuted}
                labelStyle={styles.skipButtonLabel}
              >
                Continuer sans compte
              </Button>
            </View>
          </View>
        </Animated.View>
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    padding: spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContentWrapper: {
    width: width - spacing.xl * 2,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: COLORS.surface,
  },
  modalInner: {
    padding: spacing.xl,
    paddingTop: spacing.xxl,
  },
  closeButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    zIndex: 10,
    margin: 0,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logo: {
    width: 140,
    height: 40,
    marginBottom: spacing.md,
  },
  modalTitle: {
    color: COLORS.text,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: spacing.xs,
    fontSize: 24,
  },
  modalDescription: {
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    lineHeight: 20,
  },
  actions: {
    gap: spacing.md,
  },
  loginButtonGradient: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  loginButton: {
    width: '100%',
    height: 52,
    justifyContent: 'center',
  },
  loginButtonLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  registerButton: {
    height: 52,
    justifyContent: 'center',
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1.5,
    borderRadius: borderRadius.lg,
  },
  buttonContent: {
    height: 52,
  },
  skipButton: {
    marginTop: spacing.xs,
  },
  skipButtonLabel: {
    fontSize: 14,
  },
});
