package backoffice

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha1"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base32"
	"encoding/base64"
	"encoding/binary"
	"encoding/hex"
	"errors"
	"fmt"
	"net/url"
	"strings"
	"time"
)

const (
	totpPeriod = 30 * time.Second
	totpDigits = 6
	// One step either side: a phone clock a few seconds off still passes.
	totpSkew = 1
)

var b32 = base32.StdEncoding.WithPadding(base32.NoPadding)

func newTOTPSecret() (string, error) {
	buf := make([]byte, 20)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return b32.EncodeToString(buf), nil
}

// totpAt is RFC 6238 with the defaults every authenticator app assumes
// (HMAC-SHA1, 30 s, 6 digits).
func totpAt(secret string, counter uint64) (string, error) {
	key, err := b32.DecodeString(strings.ToUpper(strings.TrimSpace(secret)))
	if err != nil {
		return "", err
	}
	var msg [8]byte
	binary.BigEndian.PutUint64(msg[:], counter)
	mac := hmac.New(sha1.New, key)
	mac.Write(msg[:])
	sum := mac.Sum(nil)
	offset := sum[len(sum)-1] & 0x0f
	value := binary.BigEndian.Uint32(sum[offset:offset+4]) & 0x7fffffff
	return fmt.Sprintf("%0*d", totpDigits, value%1000000), nil
}

// matchTOTP returns the counter the code belongs to, so the caller can refuse
// a code already used in the same window.
func matchTOTP(secret, code string, now time.Time) (uint64, bool) {
	code = strings.ReplaceAll(strings.TrimSpace(code), " ", "")
	if len(code) != totpDigits {
		return 0, false
	}
	current := uint64(now.Unix() / int64(totpPeriod.Seconds()))
	for delta := -totpSkew; delta <= totpSkew; delta++ {
		counter := uint64(int64(current) + int64(delta))
		want, err := totpAt(secret, counter)
		if err != nil {
			return 0, false
		}
		if subtle.ConstantTimeCompare([]byte(want), []byte(code)) == 1 {
			return counter, true
		}
	}
	return 0, false
}

func otpauthURL(secret, account string) string {
	label := url.PathEscape("Esport News:" + account)
	q := url.Values{}
	q.Set("secret", secret)
	q.Set("issuer", "Esport News")
	q.Set("algorithm", "SHA1")
	q.Set("digits", "6")
	q.Set("period", "30")
	return "otpauth://totp/" + label + "?" + q.Encode()
}

// seal keeps the TOTP secret unreadable in a database dump: it must be
// recoverable, so it can't be hashed.
func (m *Module) seal(plain string) (string, error) {
	nonce := make([]byte, m.aead.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(m.aead.Seal(nonce, nonce, []byte(plain), nil)), nil
}

func (m *Module) open(sealed string) (string, error) {
	raw, err := base64.StdEncoding.DecodeString(sealed)
	if err != nil {
		return "", err
	}
	if len(raw) < m.aead.NonceSize() {
		return "", errors.New("sealed value too short")
	}
	plain, err := m.aead.Open(nil, raw[:m.aead.NonceSize()], raw[m.aead.NonceSize():], nil)
	if err != nil {
		return "", err
	}
	return string(plain), nil
}

func randomToken(bytes int) (string, error) {
	buf := make([]byte, bytes)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

const backupAlphabet = "abcdefghjkmnpqrstuvwxyz23456789"

// newBackupCode is xxxxx-xxxxx, without the characters people confuse.
func newBackupCode() (string, error) {
	buf := make([]byte, 10)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	out := make([]byte, 0, 11)
	for i, b := range buf {
		if i == 5 {
			out = append(out, '-')
		}
		out = append(out, backupAlphabet[int(b)%len(backupAlphabet)])
	}
	return string(out), nil
}

func normalizeBackupCode(code string) string {
	code = strings.ToLower(strings.TrimSpace(code))
	code = strings.ReplaceAll(code, " ", "")
	if len(code) == 10 && !strings.Contains(code, "-") {
		code = code[:5] + "-" + code[5:]
	}
	return code
}
