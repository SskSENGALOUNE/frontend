package middleware

import (
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"

	"money-manager/pkg/response"
)

const userIDKey = "user_id"

func GenerateToken(secret, userID string, expiry time.Duration) (string, error) {
	claims := jwt.RegisteredClaims{
		Subject:   userID,
		IssuedAt:  jwt.NewNumericDate(time.Now()),
		ExpiresAt: jwt.NewNumericDate(time.Now().Add(expiry)),
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(secret))
}

func JWTAuth(secret string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		header := c.Get(fiber.HeaderAuthorization)
		tokenStr, ok := strings.CutPrefix(header, "Bearer ")
		if !ok || tokenStr == "" {
			return response.Error(c, fiber.StatusUnauthorized, "missing bearer token")
		}

		claims := &jwt.RegisteredClaims{}
		token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
			return []byte(secret), nil
		}, jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}))
		if err != nil || !token.Valid || claims.Subject == "" {
			return response.Error(c, fiber.StatusUnauthorized, "invalid or expired token")
		}

		c.Locals(userIDKey, claims.Subject)
		return c.Next()
	}
}

func UserID(c *fiber.Ctx) string {
	id, _ := c.Locals(userIDKey).(string)
	return id
}
