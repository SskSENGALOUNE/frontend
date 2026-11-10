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

type RecurringHandler struct {
	repo *repositories.RecurringRepository
	loc  *time.Location
}

func NewRecurringHandler(repo *repositories.RecurringRepository, loc *time.Location) *RecurringHandler {
	return &RecurringHandler{repo: repo, loc: loc}
}

type createRecurringRequest struct {
	Type       string  `json:"type" validate:"required,oneof=income expense"`
	CategoryID string  `json:"category_id" validate:"required,uuid"`
	Amount     float64 `json:"amount" validate:"required,gt=0"`
	Note       *string `json:"note" validate:"omitempty,max=500"`
	Frequency  string  `json:"frequency" validate:"required,oneof=daily weekly monthly yearly"`
	StartDate  string  `json:"start_date" validate:"required,datetime=2006-01-02"`
	EndDate    *string `json:"end_date" validate:"omitempty,datetime=2006-01-02"`
}

type updateRecurringRequest struct {
	Type       string  `json:"type" validate:"required,oneof=income expense"`
	CategoryID string  `json:"category_id" validate:"required,uuid"`
	Amount     float64 `json:"amount" validate:"required,gt=0"`
	Note       *string `json:"note" validate:"omitempty,max=500"`
	EndDate    *string `json:"end_date" validate:"omitempty,datetime=2006-01-02"`
	Active     bool    `json:"active"`
}

func (h *RecurringHandler) List(c *fiber.Ctx) error {
	items, err := h.repo.List(c.Context(), middleware.UserID(c))
	if err != nil {
		return repoError(c, err)
	}
	return response.OK(c, items)
}

func (h *RecurringHandler) Get(c *fiber.Ctx) error {
	id, ok, err := pathID(c)
	if !ok {
		return err
	}
	item, err := h.repo.Get(c.Context(), middleware.UserID(c), id)
	if err != nil {
		return repoError(c, err)
	}
	return response.OK(c, item)
}

// Create saves the template and immediately generates any occurrences already due
// (e.g. a start_date in the past).
func (h *RecurringHandler) Create(c *fiber.Ctx) error {
	var req createRecurringRequest
	if ok, err := middleware.BindAndValidate(c, &req); !ok {
		return err
	}
	if req.EndDate != nil && *req.EndDate < req.StartDate {
		return response.Error(c, fiber.StatusBadRequest, "end_date must not be before start_date")
	}
	userID := middleware.UserID(c)
	item, err := h.repo.Create(c.Context(), &models.RecurringTransaction{
		UserID: userID, Type: req.Type, CategoryID: req.CategoryID, Amount: req.Amount, Note: req.Note,
		Frequency: req.Frequency, StartDate: req.StartDate, EndDate: req.EndDate,
	})
	if err != nil {
		return repoError(c, err)
	}
	if _, err := h.repo.GenerateDue(c.Context(), time.Now().In(h.loc)); err != nil {
		log.Printf("recurring: generate after create: %v", err)
	} else if item, err = h.repo.Get(c.Context(), userID, item.ID); err != nil {
		return repoError(c, err)
	}
	return response.Created(c, item)
}

func (h *RecurringHandler) Update(c *fiber.Ctx) error {
	id, ok, err := pathID(c)
	if !ok {
		return err
	}
	var req updateRecurringRequest
	if ok, err := middleware.BindAndValidate(c, &req); !ok {
		return err
	}
	userID := middleware.UserID(c)
	current, err := h.repo.Get(c.Context(), userID, id)
	if err != nil {
		return repoError(c, err)
	}
	if req.EndDate != nil && *req.EndDate < current.StartDate {
		return response.Error(c, fiber.StatusBadRequest, "end_date must not be before start_date")
	}
	now := time.Now().In(h.loc)
	item, err := h.repo.Update(c.Context(), &models.RecurringTransaction{
		ID: id, UserID: userID, Type: req.Type, CategoryID: req.CategoryID, Amount: req.Amount,
		Note: req.Note, EndDate: req.EndDate, Active: req.Active,
	}, now)
	if err != nil {
		return repoError(c, err)
	}
	// A resumed item may be due today; generate it now rather than on the next hourly tick.
	if req.Active && !current.Active {
		if _, err := h.repo.GenerateDue(c.Context(), now); err != nil {
			log.Printf("recurring: generate after resume: %v", err)
		} else if item, err = h.repo.Get(c.Context(), userID, id); err != nil {
			return repoError(c, err)
		}
	}
	return response.OK(c, item)
}

// Delete removes the template; transactions already generated from it are kept.
func (h *RecurringHandler) Delete(c *fiber.Ctx) error {
	id, ok, err := pathID(c)
	if !ok {
		return err
	}
	if err := h.repo.Delete(c.Context(), middleware.UserID(c), id); err != nil {
		return repoError(c, err)
	}
	return response.Message(c, "recurring transaction deleted")
}
