package handlers

import (
	"time"

	"github.com/gofiber/fiber/v2"

	"money-manager/internal/middleware"
	"money-manager/internal/models"
	"money-manager/internal/repositories"
	"money-manager/pkg/response"
)

type BudgetHandler struct {
	repo *repositories.BudgetRepository
	loc  *time.Location
}

func NewBudgetHandler(repo *repositories.BudgetRepository, loc *time.Location) *BudgetHandler {
	return &BudgetHandler{repo: repo, loc: loc}
}

type upsertBudgetRequest struct {
	CategoryID string  `json:"category_id" validate:"required,uuid"`
	Month      string  `json:"month"` // YYYY-MM; defaults to current month
	Amount     float64 `json:"amount" validate:"required,gt=0"`
}

type copyBudgetRequest struct {
	FromMonth string `json:"from_month" validate:"required"`
	ToMonth   string `json:"to_month" validate:"required"`
}

// List: GET /budgets?month=YYYY-MM
func (h *BudgetHandler) List(c *fiber.Ctx) error {
	month, ok := parseMonth(c.Query("month"), h.loc)
	if !ok {
		return response.Error(c, fiber.StatusBadRequest, "month must be YYYY-MM")
	}
	items, err := h.repo.List(c.Context(), middleware.UserID(c), month)
	if err != nil {
		return repoError(c, err)
	}
	return response.OK(c, items)
}

// Upsert: PUT /budgets — sets the budget of an expense category for a month.
func (h *BudgetHandler) Upsert(c *fiber.Ctx) error {
	var req upsertBudgetRequest
	if ok, err := middleware.BindAndValidate(c, &req); !ok {
		return err
	}
	month, ok := parseMonth(req.Month, h.loc)
	if !ok {
		return response.Error(c, fiber.StatusBadRequest, "month must be YYYY-MM")
	}
	b, err := h.repo.Upsert(c.Context(), &models.Budget{
		UserID: middleware.UserID(c), CategoryID: req.CategoryID, Month: month, Amount: req.Amount,
	})
	if err != nil {
		return repoError(c, err)
	}
	return response.OK(c, b)
}

// Copy: POST /budgets/copy — copies one month's budgets into another (existing ones are kept).
func (h *BudgetHandler) Copy(c *fiber.Ctx) error {
	var req copyBudgetRequest
	if ok, err := middleware.BindAndValidate(c, &req); !ok {
		return err
	}
	from, ok1 := parseMonth(req.FromMonth, h.loc)
	to, ok2 := parseMonth(req.ToMonth, h.loc)
	if !ok1 || !ok2 {
		return response.Error(c, fiber.StatusBadRequest, "months must be YYYY-MM")
	}
	n, err := h.repo.CopyMonth(c.Context(), middleware.UserID(c), from, to)
	if err != nil {
		return repoError(c, err)
	}
	return response.OK(c, fiber.Map{"copied": n})
}

func (h *BudgetHandler) Delete(c *fiber.Ctx) error {
	id, ok, err := pathID(c)
	if !ok {
		return err
	}
	if err := h.repo.Delete(c.Context(), middleware.UserID(c), id); err != nil {
		return repoError(c, err)
	}
	return response.Message(c, "budget deleted")
}
