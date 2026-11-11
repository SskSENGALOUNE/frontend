package handlers

import (
	"time"

	"github.com/gofiber/fiber/v2"

	"money-manager/internal/middleware"
	"money-manager/internal/repositories"
	"money-manager/pkg/response"
)

type ReportHandler struct {
	repo *repositories.ReportRepository
	loc  *time.Location
}

func NewReportHandler(repo *repositories.ReportRepository, loc *time.Location) *ReportHandler {
	return &ReportHandler{repo: repo, loc: loc}
}

// Summary: GET /reports/summary?from=&to=  (inclusive, defaults to current month)
// Also returns the previous period (see previousRange) for comparison.
func (h *ReportHandler) Summary(c *fiber.Ctx) error {
	from, to, err := dateRange(c, h.loc)
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, err.Error())
	}
	userID := middleware.UserID(c)
	current, err := h.repo.Summary(c.Context(), userID, from, to)
	if err != nil {
		return repoError(c, err)
	}

	prevFrom, prevTo := previousRange(from, to)
	previous, err := h.repo.Summary(c.Context(), userID, prevFrom, prevTo)
	if err != nil {
		return repoError(c, err)
	}

	return response.OK(c, fiber.Map{
		"from": from, "to": to, "summary": current,
		"previous": fiber.Map{"from": prevFrom, "to": prevTo, "summary": previous},
	})
}

// previousRange returns the period to compare [from, to] against (both inclusive, YYYY-MM-DD).
// A range of whole months (to is the day before from's day-of-month, e.g. calendar months
// 2026-10-01..2026-10-31 or pay periods 2026-10-25..2026-11-24) compares with the same number of
// whole months right before it, e.g. 2026-10-25..2026-11-24 -> 2026-09-25..2026-10-24.
// Any other range compares with the same number of days right before it.
func previousRange(from, to string) (string, string) {
	f, _ := time.Parse(dateLayout, from)
	t, _ := time.Parse(dateLayout, to)
	prevTo := f.AddDate(0, 0, -1)

	end := t.AddDate(0, 0, 1) // exclusive
	if f.Day() <= 28 && end.Day() == f.Day() {
		months := (end.Year()-f.Year())*12 + int(end.Month()) - int(f.Month())
		return f.AddDate(0, -months, 0).Format(dateLayout), prevTo.Format(dateLayout)
	}

	days := int(t.Sub(f).Hours()/24) + 1
	return prevTo.AddDate(0, 0, -(days - 1)).Format(dateLayout), prevTo.Format(dateLayout)
}

// ByCategory: GET /reports/by-category?type=expense&from=&to=
func (h *ReportHandler) ByCategory(c *fiber.Ctx) error {
	typ := c.Query("type", "expense")
	if typ != "income" && typ != "expense" {
		return response.Error(c, fiber.StatusBadRequest, "type must be income or expense")
	}
	from, to, err := dateRange(c, h.loc)
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, err.Error())
	}
	items, err := h.repo.ByCategory(c.Context(), middleware.UserID(c), typ, from, to)
	if err != nil {
		return repoError(c, err)
	}
	return response.OK(c, fiber.Map{"from": from, "to": to, "type": typ, "items": items})
}

// Trend: GET /reports/trend?period=day|month&from=&to=  (every period is present, zero-filled;
// "month" means pay period, named by the month it ends in)
func (h *ReportHandler) Trend(c *fiber.Ctx) error {
	period := c.Query("period", "day")
	if period != "day" && period != "month" {
		return response.Error(c, fiber.StatusBadRequest, "period must be day or month")
	}
	from, to, err := dateRange(c, h.loc)
	if err != nil {
		return response.Error(c, fiber.StatusBadRequest, err.Error())
	}
	f, _ := time.Parse(dateLayout, from)
	t, _ := time.Parse(dateLayout, to)
	if period == "day" && t.Sub(f) > 366*24*time.Hour {
		return response.Error(c, fiber.StatusBadRequest, "daily trend is limited to one year; use period=month")
	}
	items, err := h.repo.Trend(c.Context(), middleware.UserID(c), period, from, to)
	if err != nil {
		return repoError(c, err)
	}
	return response.OK(c, fiber.Map{"from": from, "to": to, "period": period, "items": items})
}

// FrequentAmounts: GET /reports/frequent-amounts — per category, the 5 amounts used most
// often in the last 180 days (smallest first), for the quick-amount buttons on the entry page.
func (h *ReportHandler) FrequentAmounts(c *fiber.Ctx) error {
	since := time.Now().In(h.loc).AddDate(0, 0, -180).Format(dateLayout)
	items, err := h.repo.FrequentAmounts(c.Context(), middleware.UserID(c), since, 5)
	if err != nil {
		return repoError(c, err)
	}
	return response.OK(c, fiber.Map{"items": items})
}

// Budget: GET /reports/budget?month=YYYY-MM — budget vs actual spending per category
// during that month's pay period (see periodRange).
func (h *ReportHandler) Budget(c *fiber.Ctx) error {
	month, ok := parseMonth(c.Query("month"), h.loc)
	if !ok {
		return response.Error(c, fiber.StatusBadRequest, "month must be YYYY-MM")
	}
	from, to := periodRange(month)
	items, err := h.repo.BudgetStatus(c.Context(), middleware.UserID(c), month, from, to)
	if err != nil {
		return repoError(c, err)
	}
	var budget, spent float64
	for _, it := range items {
		budget += it.Budget
		spent += it.Spent
	}
	return response.OK(c, fiber.Map{
		"month": month[:7], "from": from, "to": to, "items": items,
		"total": fiber.Map{"budget": budget, "spent": spent, "remaining": budget - spent},
	})
}
