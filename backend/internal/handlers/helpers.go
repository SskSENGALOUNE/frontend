package handlers

import (
	"context"
	"errors"
	"log"
	"time"

	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"

	"money-manager/internal/middleware"
	"money-manager/internal/repositories"
	"money-manager/pkg/response"
)

var idValidator = validator.New()

// pathID returns the :id param, or ok=false after writing a 400 if it is not a UUID.
func pathID(c *fiber.Ctx) (string, bool, error) {
	id := c.Params("id")
	if idValidator.Var(id, "uuid") != nil {
		return "", false, response.Error(c, fiber.StatusBadRequest, "invalid id")
	}
	return id, true, nil
}

func isUUID(s string) bool { return idValidator.Var(s, "uuid") == nil }

// repoError maps repository errors to HTTP responses.
func repoError(c *fiber.Ctx, err error) error {
	switch {
	case errors.Is(err, repositories.ErrNotFound):
		return response.Error(c, fiber.StatusNotFound, "not found")
	case errors.Is(err, repositories.ErrDuplicate):
		return response.Error(c, fiber.StatusConflict, "already exists")
	case errors.Is(err, repositories.ErrInvalidCategory):
		return response.Error(c, fiber.StatusBadRequest, "category not found or its type does not match")
	case errors.Is(err, repositories.ErrInUse):
		return response.Error(c, fiber.StatusConflict, "still in use")
	case errors.Is(err, repositories.ErrTooMany):
		return response.Error(c, fiber.StatusConflict, "limit reached")
	default:
		log.Printf("%s %s: %v", c.Method(), c.Path(), err)
		return response.Error(c, fiber.StatusInternalServerError, "internal server error")
	}
}

const dateLayout = "2006-01-02"

func isDate(s string) bool {
	_, err := time.Parse(dateLayout, s)
	return err == nil
}

// today returns the current date in loc as "YYYY-MM-DD".
func today(loc *time.Location) string { return time.Now().In(loc).Format(dateLayout) }

// A "month" in reports and budgets is the user's pay period that ends in that month. With
// pay day 25, month 2026-11 covers 2026-10-25 .. 2026-11-24; with pay day 1 it is the calendar
// month. Pay days are 1..28 (users.pay_day), so every month has one.

// payDayLookup reads a user's pay day; implemented by UserRepository.
type payDayLookup interface {
	PayDay(ctx context.Context, userID string) (int, error)
}

// userPayDay returns the signed-in user's pay day, or the default if it cannot be read.
func userPayDay(c *fiber.Ctx, users payDayLookup) int {
	d, err := users.PayDay(c.Context(), middleware.UserID(c))
	if err != nil || d < 1 || d > 28 {
		if err != nil {
			log.Printf("pay day for %s: %v", middleware.UserID(c), err)
		}
		return repositories.DefaultPayDay
	}
	return d
}

// currentPeriodMonth returns the first day of the month whose pay period contains now.
func currentPeriodMonth(now time.Time, payDay int) time.Time {
	m := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	if payDay > 1 && now.Day() >= payDay {
		m = m.AddDate(0, 1, 0)
	}
	return m
}

// periodRange returns the inclusive pay period of a month given as its first day ("YYYY-MM-01").
func periodRange(month string, payDay int) (string, string) {
	m, _ := time.Parse(dateLayout, month)
	if payDay <= 1 {
		return m.Format(dateLayout), m.AddDate(0, 1, -1).Format(dateLayout)
	}
	return m.AddDate(0, -1, payDay-1).Format(dateLayout), m.AddDate(0, 0, payDay-2).Format(dateLayout)
}

// nextPayday returns the next payday on or after now, as "YYYY-MM-DD".
func nextPayday(now time.Time, payDay int) string {
	d := time.Date(now.Year(), now.Month(), payDay, 0, 0, 0, 0, time.UTC)
	if now.Day() > payDay {
		d = d.AddDate(0, 1, 0)
	}
	return d.Format(dateLayout)
}

// parseMonth accepts "YYYY-MM" or "YYYY-MM-DD" and returns the first day of that month.
// Empty input means the month of the current pay period in loc.
func parseMonth(s string, loc *time.Location, payDay int) (string, bool) {
	if s == "" {
		return currentPeriodMonth(time.Now().In(loc), payDay).Format(dateLayout), true
	}
	t, err := time.Parse("2006-01", s)
	if err != nil {
		if t, err = time.Parse(dateLayout, s); err != nil {
			return "", false
		}
	}
	return time.Date(t.Year(), t.Month(), 1, 0, 0, 0, 0, time.UTC).Format(dateLayout), true
}

// dateRange reads inclusive ?from=YYYY-MM-DD&to=YYYY-MM-DD, defaulting to the current pay period in loc.
func dateRange(c *fiber.Ctx, loc *time.Location, payDay int) (string, string, error) {
	defFrom, defTo := periodRange(currentPeriodMonth(time.Now().In(loc), payDay).Format(dateLayout), payDay)
	from := c.Query("from", defFrom)
	to := c.Query("to", defTo)

	if !isDate(from) {
		return "", "", errors.New("from must be YYYY-MM-DD")
	}
	if !isDate(to) {
		return "", "", errors.New("to must be YYYY-MM-DD")
	}
	if to < from {
		return "", "", errors.New("to must not be before from")
	}
	return from, to, nil
}
