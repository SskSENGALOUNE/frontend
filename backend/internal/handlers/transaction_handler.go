package handlers

import (
	"errors"
	"time"

	"github.com/gofiber/fiber/v2"

	"money-manager/internal/middleware"
	"money-manager/internal/models"
	"money-manager/internal/repositories"
	"money-manager/pkg/response"
)

type TransactionHandler struct {
	repo *repositories.TransactionRepository
	loc  *time.Location
}

func NewTransactionHandler(repo *repositories.TransactionRepository, loc *time.Location) *TransactionHandler {
	return &TransactionHandler{repo: repo, loc: loc}
}

type transactionRequest struct {
	Type       string  `json:"type" validate:"required,oneof=income expense"`
	CategoryID string  `json:"category_id" validate:"required,uuid"`
	Amount     float64 `json:"amount" validate:"required,gt=0"`
	TxnDate    string  `json:"txn_date" validate:"omitempty,datetime=2006-01-02"`
	Note       *string `json:"note" validate:"omitempty,max=500"`
}

func (r transactionRequest) toModel(userID string, loc *time.Location) *models.Transaction {
	t := &models.Transaction{
		UserID: userID, Type: r.Type, CategoryID: r.CategoryID, Amount: r.Amount,
		TxnDate: r.TxnDate, Note: r.Note,
	}
	if t.TxnDate == "" {
		t.TxnDate = today(loc)
	}
	return t
}

// List: GET /transactions?type=&category_id=&from=&to=&q=&page=1&limit=20
// Returns the page plus income/expense totals of the whole filtered set.
func (h *TransactionHandler) List(c *fiber.Ctx) error {
	f := models.TransactionFilter{
		Type:       c.Query("type"),
		CategoryID: c.Query("category_id"),
		From:       c.Query("from"),
		To:         c.Query("to"),
		Search:     c.Query("q"),
		Limit:      c.QueryInt("limit", 20),
	}
	if f.Type != "" && f.Type != "income" && f.Type != "expense" {
		return response.Error(c, fiber.StatusBadRequest, "type must be income or expense")
	}
	if f.CategoryID != "" && !isUUID(f.CategoryID) {
		return response.Error(c, fiber.StatusBadRequest, "invalid category_id")
	}
	if (f.From != "" && !isDate(f.From)) || (f.To != "" && !isDate(f.To)) {
		return response.Error(c, fiber.StatusBadRequest, "from/to must be YYYY-MM-DD")
	}
	if f.Limit < 1 || f.Limit > 100 {
		f.Limit = 20
	}
	page := c.QueryInt("page", 1)
	if page < 1 {
		page = 1
	}
	f.Offset = (page - 1) * f.Limit

	p, err := h.repo.List(c.Context(), middleware.UserID(c), f)
	if err != nil {
		return repoError(c, err)
	}
	return response.OK(c, fiber.Map{
		"items":  p.Items,
		"totals": fiber.Map{"income": p.Income, "expense": p.Expense, "net": p.Income - p.Expense},
		"pagination": fiber.Map{
			"page": page, "limit": f.Limit, "total": p.Total,
			"total_pages": (p.Total + f.Limit - 1) / f.Limit,
		},
	})
}

func (h *TransactionHandler) Get(c *fiber.Ctx) error {
	id, ok, err := pathID(c)
	if !ok {
		return err
	}
	t, err := h.repo.Get(c.Context(), middleware.UserID(c), id)
	if err != nil {
		return repoError(c, err)
	}
	return response.OK(c, t)
}

func (h *TransactionHandler) Create(c *fiber.Ctx) error {
	var req transactionRequest
	if ok, err := middleware.BindAndValidate(c, &req); !ok {
		return err
	}
	t, err := h.repo.Create(c.Context(), req.toModel(middleware.UserID(c), h.loc))
	if err != nil {
		return repoError(c, err)
	}
	return response.Created(c, t)
}

type bulkExpenseItem struct {
	CategoryID string  `json:"category_id" validate:"required,uuid"`
	Amount     float64 `json:"amount" validate:"required,gt=0"`
	Note       *string `json:"note" validate:"omitempty,max=500"`
	TxnDate    string  `json:"txn_date" validate:"omitempty,datetime=2006-01-02"`
}

const maxBulkItems = 100

// CreateExpenses: POST /expenses — body is an array of {category_id, amount}; note and txn_date
// (default today) are optional. All items are saved together or none are.
func (h *TransactionHandler) CreateExpenses(c *fiber.Ctx) error {
	var req []bulkExpenseItem
	if ok, err := middleware.BindAndValidateList(c, &req, maxBulkItems); !ok {
		return err
	}
	date := today(h.loc)
	items := make([]models.Transaction, len(req))
	for i, r := range req {
		items[i] = models.Transaction{Type: "expense", CategoryID: r.CategoryID, Amount: r.Amount, Note: r.Note, TxnDate: r.TxnDate}
		if items[i].TxnDate == "" {
			items[i].TxnDate = date
		}
	}

	created, err := h.repo.CreateMany(c.Context(), middleware.UserID(c), items)
	var invalid *repositories.InvalidItemsError
	if errors.As(err, &invalid) {
		return c.Status(fiber.StatusBadRequest).JSON(response.Body{
			Success: false,
			Message: "expense category not found for some items",
			Errors:  fiber.Map{"invalid_items": invalid.Indexes},
		})
	}
	if err != nil {
		return repoError(c, err)
	}

	var total float64
	for _, t := range created {
		total += t.Amount
	}
	return response.Created(c, fiber.Map{"count": len(created), "total": total, "items": created})
}

func (h *TransactionHandler) Update(c *fiber.Ctx) error {
	id, ok, err := pathID(c)
	if !ok {
		return err
	}
	var req transactionRequest
	if ok, err := middleware.BindAndValidate(c, &req); !ok {
		return err
	}
	m := req.toModel(middleware.UserID(c), h.loc)
	m.ID = id
	t, err := h.repo.Update(c.Context(), m)
	if err != nil {
		return repoError(c, err)
	}
	return response.OK(c, t)
}

func (h *TransactionHandler) Delete(c *fiber.Ctx) error {
	id, ok, err := pathID(c)
	if !ok {
		return err
	}
	if err := h.repo.Delete(c.Context(), middleware.UserID(c), id); err != nil {
		return repoError(c, err)
	}
	return response.Message(c, "transaction deleted")
}
