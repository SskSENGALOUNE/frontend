package handlers

import (
	"log"
	"time"

	"github.com/gofiber/fiber/v2"

	"money-manager/internal/middleware"
	"money-manager/internal/models"
	"money-manager/internal/repositories"
	"money-manager/pkg/response"
)

type GoalHandler struct {
	goals     *repositories.GoalRepository
	txns      *repositories.TransactionRepository
	recurring *repositories.RecurringRepository
	loc       *time.Location
}

func NewGoalHandler(goals *repositories.GoalRepository, txns *repositories.TransactionRepository, recurring *repositories.RecurringRepository, loc *time.Location) *GoalHandler {
	return &GoalHandler{goals: goals, txns: txns, recurring: recurring, loc: loc}
}

type goalRequest struct {
	Name         string  `json:"name" validate:"required,max=100"`
	TargetAmount float64 `json:"target_amount" validate:"required,gt=0"`
	// Automatic deposit on each payday; null or 0 means none.
	MonthlyAmount *float64 `json:"monthly_amount" validate:"omitempty,gte=0"`
}

func (r goalRequest) monthly() *float64 {
	if r.MonthlyAmount == nil || *r.MonthlyAmount <= 0 {
		return nil
	}
	return r.MonthlyAmount
}

// nextPayday returns the next payday on or after today in loc, as "YYYY-MM-DD".
func nextPayday(now time.Time) string {
	d := time.Date(now.Year(), now.Month(), payDay, 0, 0, 0, 0, time.UTC)
	if now.Day() > payDay {
		d = d.AddDate(0, 1, 0)
	}
	return d.Format(dateLayout)
}

func (h *GoalHandler) List(c *fiber.Ctx) error {
	items, err := h.goals.List(c.Context(), middleware.UserID(c))
	if err != nil {
		return repoError(c, err)
	}
	return response.OK(c, items)
}

// generateDue runs a deposit that is due today right away instead of on the hourly tick.
func (h *GoalHandler) generateDue(c *fiber.Ctx, g *models.Goal) *models.Goal {
	if g.NextDeposit == nil || *g.NextDeposit > today(h.loc) {
		return g
	}
	if _, err := h.recurring.GenerateDue(c.Context(), time.Now().In(h.loc)); err != nil {
		log.Printf("goals: generate due deposit: %v", err)
		return g
	}
	if fresh, err := h.goals.Get(c.Context(), g.UserID, g.ID); err == nil {
		return fresh
	}
	return g
}

func (h *GoalHandler) Create(c *fiber.Ctx) error {
	var req goalRequest
	if ok, err := middleware.BindAndValidate(c, &req); !ok {
		return err
	}
	now := time.Now().In(h.loc)
	g, err := h.goals.Create(c.Context(), &models.Goal{
		UserID: middleware.UserID(c), Name: req.Name, TargetAmount: req.TargetAmount,
	}, req.monthly(), nextPayday(now))
	if err != nil {
		return repoError(c, err)
	}
	return response.Created(c, h.generateDue(c, g))
}

func (h *GoalHandler) Update(c *fiber.Ctx) error {
	id, ok, err := pathID(c)
	if !ok {
		return err
	}
	var req goalRequest
	if ok, err := middleware.BindAndValidate(c, &req); !ok {
		return err
	}
	now := time.Now().In(h.loc)
	g, err := h.goals.Update(c.Context(), &models.Goal{
		ID: id, UserID: middleware.UserID(c), Name: req.Name, TargetAmount: req.TargetAmount,
	}, req.monthly(), nextPayday(now), now)
	if err != nil {
		return repoError(c, err)
	}
	return response.OK(c, h.generateDue(c, g))
}

func (h *GoalHandler) Delete(c *fiber.Ctx) error {
	id, ok, err := pathID(c)
	if !ok {
		return err
	}
	if err := h.goals.Delete(c.Context(), middleware.UserID(c), id); err != nil {
		return repoError(c, err)
	}
	return response.Message(c, "goal deleted")
}

type depositRequest struct {
	Amount  float64 `json:"amount" validate:"required,gt=0"`
	TxnDate string  `json:"txn_date" validate:"omitempty,datetime=2006-01-02"`
	Note    *string `json:"note" validate:"omitempty,max=500"`
}

// Deposit: POST /goals/:id/deposits — records an expense in the goal's category, tagged with the goal.
func (h *GoalHandler) Deposit(c *fiber.Ctx) error {
	id, ok, err := pathID(c)
	if !ok {
		return err
	}
	var req depositRequest
	if ok, err := middleware.BindAndValidate(c, &req); !ok {
		return err
	}
	userID := middleware.UserID(c)
	g, err := h.goals.Get(c.Context(), userID, id)
	if err != nil {
		return repoError(c, err)
	}
	date := req.TxnDate
	if date == "" {
		date = today(h.loc)
	}
	note := req.Note
	if note == nil {
		n := "ອອມ: " + g.Name
		note = &n
	}
	if _, err := h.txns.Create(c.Context(), &models.Transaction{
		UserID: userID, Type: "expense", CategoryID: g.CategoryID, Amount: req.Amount,
		TxnDate: date, Note: note, GoalID: &g.ID,
	}); err != nil {
		return repoError(c, err)
	}
	g, err = h.goals.Get(c.Context(), userID, id)
	if err != nil {
		return repoError(c, err)
	}
	return response.Created(c, g)
}

// ---- favorites ----

type FavoriteHandler struct {
	repo *repositories.FavoriteRepository
}

func NewFavoriteHandler(repo *repositories.FavoriteRepository) *FavoriteHandler {
	return &FavoriteHandler{repo: repo}
}

type favoriteRequest struct {
	Type       string  `json:"type" validate:"required,oneof=income expense"`
	CategoryID string  `json:"category_id" validate:"required,uuid"`
	Amount     float64 `json:"amount" validate:"required,gt=0"`
	Note       *string `json:"note" validate:"omitempty,max=500"`
}

func (h *FavoriteHandler) List(c *fiber.Ctx) error {
	items, err := h.repo.List(c.Context(), middleware.UserID(c))
	if err != nil {
		return repoError(c, err)
	}
	return response.OK(c, items)
}

func (h *FavoriteHandler) Create(c *fiber.Ctx) error {
	var req favoriteRequest
	if ok, err := middleware.BindAndValidate(c, &req); !ok {
		return err
	}
	f, err := h.repo.Create(c.Context(), &models.Favorite{
		UserID: middleware.UserID(c), Type: req.Type, CategoryID: req.CategoryID, Amount: req.Amount, Note: req.Note,
	})
	if err != nil {
		return repoError(c, err)
	}
	return response.Created(c, f)
}

func (h *FavoriteHandler) Delete(c *fiber.Ctx) error {
	id, ok, err := pathID(c)
	if !ok {
		return err
	}
	if err := h.repo.Delete(c.Context(), middleware.UserID(c), id); err != nil {
		return repoError(c, err)
	}
	return response.Message(c, "favorite deleted")
}
