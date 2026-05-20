// go/auth/hash.go

package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"fmt"
	"strconv"
	"strings"
)

const (
	pbkdf2Iterations = 210000
	saltSize         = 16
	keySize          = 32
)

func HashPassword(password string) (string, error) {
	salt := make([]byte, saltSize)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}

	key := pbkdf2Key([]byte(password), salt, pbkdf2Iterations, keySize)

	return fmt.Sprintf("pbkdf2$%d$%s$%s",
		pbkdf2Iterations,
		base64.RawStdEncoding.EncodeToString(salt),
		base64.RawStdEncoding.EncodeToString(key),
	), nil
}

func VerifyPassword(hash string, password string) bool {
	parts := strings.Split(hash, "$")
	if len(parts) != 4 || parts[0] != "pbkdf2" {
		return false
	}

	iterations, err := strconv.Atoi(parts[1])
	if err != nil {
		return false
	}

	salt, err := base64.RawStdEncoding.DecodeString(parts[2])
	if err != nil {
		return false
	}

	expectedKey, err := base64.RawStdEncoding.DecodeString(parts[3])
	if err != nil {
		return false
	}

	return subtle.ConstantTimeCompare(pbkdf2Key([]byte(password), salt, iterations, len(expectedKey)), expectedKey) == 1
}

func pbkdf2Key(password, salt []byte, iter, keyLen int) []byte {
	prf := func(data []byte) []byte {
		h := sha256.New()
		if len(password) > 64 {
			s := sha256.Sum256(password)
			password = s[:]
		}
		ipad := make([]byte, 64)
		opad := make([]byte, 64)
		copy(ipad, password)
		copy(opad, password)
		for i := range ipad {
			ipad[i] ^= 0x36
			opad[i] ^= 0x5c
		}
		h.Write(ipad)
		h.Write(data)
		inner := h.Sum(nil)
		h.Reset()
		h.Write(opad)
		h.Write(inner)
		return h.Sum(nil)
	}

	var result []byte
	numBlocks := (keyLen + 31) / 32

	var buf [4]byte
	for block := 1; block <= numBlocks; block++ {
		buf[0] = byte(block >> 24)
		buf[1] = byte(block >> 16)
		buf[2] = byte(block >> 8)
		buf[3] = byte(block)

		u := prf(append(salt, buf[:]...))
		t := make([]byte, len(u))
		copy(t, u)

		for n := 2; n <= iter; n++ {
			u = prf(u)
			for i := range t {
				t[i] ^= u[i]
			}
		}
		result = append(result, t...)
	}

	return result[:keyLen]
}
