package backoffice

import (
	"testing"
	"time"
)

// RFC 6238, appendix B (SHA-1 rows), truncated to the six digits apps display.
const rfcSecret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"

func TestTOTPMatchesRFC6238Vectors(t *testing.T) {
	for unix, want := range map[int64]string{
		59:          "287082",
		1111111109:  "081804",
		1234567890:  "005924",
		2000000000:  "279037",
		20000000000: "353130",
	} {
		got, err := totpAt(rfcSecret, uint64(unix/30))
		if err != nil || got != want {
			t.Errorf("t=%d: got %q (%v), want %q", unix, got, err, want)
		}
	}
}

func TestMatchTOTPAcceptsOneStepOfDrift(t *testing.T) {
	now := time.Unix(1234567890, 0)
	code, _ := totpAt(rfcSecret, uint64(now.Unix()/30))

	for _, shift := range []time.Duration{0, -30 * time.Second, 30 * time.Second} {
		if _, ok := matchTOTP(rfcSecret, code, now.Add(shift)); !ok {
			t.Errorf("code refused with a clock off by %v", shift)
		}
	}
	if _, ok := matchTOTP(rfcSecret, code, now.Add(90*time.Second)); ok {
		t.Error("code accepted three steps late")
	}
	if _, ok := matchTOTP(rfcSecret, "12345", now); ok {
		t.Error("a five-digit code was accepted")
	}
}

func TestBackupCodeNormalization(t *testing.T) {
	code, err := newBackupCode()
	if err != nil || len(code) != 11 || code[5] != '-' {
		t.Fatalf("unexpected backup code %q (%v)", code, err)
	}
	compact := code[:5] + code[6:]
	for _, typed := range []string{code, " " + code + " ", compact, compact[:5] + " " + compact[5:]} {
		if normalizeBackupCode(typed) != code {
			t.Errorf("%q does not normalize to %q", typed, code)
		}
	}
}

func TestRolePermissionsFollowTheMatrix(t *testing.T) {
	cases := []struct {
		role Role
		perm Perm
		want bool
	}{
		{RoleAdmin, PermTeamManage, true},
		{RoleEditor, PermArticlesWrite, true},
		{RoleEditor, PermArticlesWriteAny, false},
		{RoleEditor, PermHealthRead, false},
		{RoleEditor, PermAnalyticsRead, true},
		{RoleReader, PermHealthRead, true},
		{RoleReader, PermArticlesWrite, false},
		{RoleReader, PermAuditRead, false},
		{RoleUser, PermAnalyticsRead, false},
	}
	for _, tc := range cases {
		if got := tc.role.Can(tc.perm); got != tc.want {
			t.Errorf("%s can %s = %v, want %v", tc.role, tc.perm, got, tc.want)
		}
	}
}
