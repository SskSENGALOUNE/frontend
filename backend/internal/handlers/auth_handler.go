package handlers

import (
	"errors"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"golang.org/x/crypto/bcrypt"

	"money-manager/internal/middleware"
	"money-manager/internal/models"
	"money-manager/internal/repositories"
	"money-manager/pkg/response"
)

type AuthHandler struct {
	users     *repositories.UserRepository
	jwtSecret string
	jwtExpiry time.Duration
	loc       *time.Location
}

func NewAuthHandler(users *repositories.UserRepository, secret string, expiry time.Duration, loc *time.Location) *AuthHandler {
	return &AuthHandler{users: users, jwtSecret: secret, jwtExpiry: expiry, loc: loc}
}

type registerRequest struct {
	Name     string `json:"name" validate:"required,max=100"`
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required,min=6,max=72"`
	Currency string `json:"currency" validate:"omitempty,len=3"`
}

type loginRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required"`
}

type updateProfileRequest struct {
	Name     string `json:"name" validate:"required,max=100"`
	Currency string `json:"currency" validate:"required,len=3"`
	// First day of a pay period; omitted keeps the current one.
	PayDay *int `json:"pay_day" validate:"omitempty,min=1,max=28"`
}

type changePasswordRequest struct {
	CurrentPassword string `json:"current_password" validate:"required"`
	NewPassword     string `json:"new_password" validate:"required,min=6,max=72"`
}

type authResponse struct {
	Token string       `json:"token"`
	User  *models.User `json:"user"`
}

func (h *AuthHandler) Register(c *fiber.Ctx) error {
	var req registerRequest
	if ok, err := middleware.BindAndValidate(c, &req); !ok {
		return err
	}
	if req.Currency == "" {
		req.Currency = "LAK"
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return repoError(c, err)
	}

	user, err := h.users.Create(c.Context(), strings.TrimSpace(req.Name),
		strings.ToLower(strings.TrimSpace(req.Email)), string(hash), strings.ToUpper(req.Currency))
	if errors.Is(err, repositories.ErrDuplicate) {
		return response.Error(c, fiber.StatusConflict, "email already registered")
	}
	if err != nil {
		return repoError(c, err)
	}
	return h.issueToken(c, user, fiber.StatusCreated)
}

func (h *AuthHandler) Login(c *fiber.Ctx) error {
	var req loginRequest
	if ok, err := middleware.BindAndValidate(c, &req); !ok {
		return err
	}

	user, err := h.users.FindByEmail(c.Context(), strings.ToLower(strings.TrimSpace(req.Email)))
	if errors.Is(err, repositories.ErrNotFound) {
		return response.Error(c, fiber.StatusUnauthorized, "invalid email or password")
	}
	if err != nil {
		return repoError(c, err)
	}
	if bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)) != nil {
		return response.Error(c, fiber.StatusUnauthorized, "invalid email or password")
	}
	return h.issueToken(c, user, fiber.StatusOK)
}

func (h *AuthHandler) Me(c *fiber.Ctx) error {
	user, err := h.users.FindByID(c.Context(), middleware.UserID(c))
	if err != nil {
		return repoError(c, err)
	}
	return response.OK(c, user)
}

func (h *AuthHandler) UpdateProfile(c *fiber.Ctx) error {
	var req updateProfileRequest
	if ok, err := middleware.BindAndValidate(c, &req); !ok {
		return err
	}
	now := time.Now().In(h.loc)
	user, err := h.users.Update(c.Context(), middleware.UserID(c),
		strings.TrimSpace(req.Name), strings.ToUpper(req.Currency), req.PayDay,
		func(day int) string { return nextPayday(now, day) })
	if err != nil {
		return repoError(c, err)
	}
	return response.OK(c, user)
}

func (h *AuthHandler) ChangePassword(c *fiber.Ctx) error {
	var req changePasswordRequest
	if ok, err := middleware.BindAndValidate(c, &req); !ok {
		return err
	}
	user, err := h.users.FindByID(c.Context(), middleware.UserID(c))
	if err != nil {
		return repoError(c, err)
	}
	if bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.CurrentPassword)) != nil {
		return response.Error(c, fiber.StatusBadRequest, "current password is incorrect")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		return repoError(c, err)
	}
	if err := h.users.UpdatePassword(c.Context(), user.ID, string(hash)); err != nil {
		return repoError(c, err)
	}
	return response.Message(c, "password updated")
}

func (h *AuthHandler) issueToken(c *fiber.Ctx, user *models.User, status int) error {
	token, err := middleware.GenerateToken(h.jwtSecret, user.ID, h.jwtExpiry)
	if err != nil {
		return repoError(c, err)
	}
	return c.Status(status).JSON(response.Body{Success: true, Data: authResponse{Token: token, User: user}})
}
