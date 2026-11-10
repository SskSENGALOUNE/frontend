package handlers

import (
	"github.com/gofiber/fiber/v2"

	"money-manager/internal/middleware"
	"money-manager/internal/models"
	"money-manager/internal/repositories"
	"money-manager/pkg/response"
)

type CategoryHandler struct {
	repo *repositories.CategoryRepository
}

func NewCategoryHandler(repo *repositories.CategoryRepository) *CategoryHandler {
	return &CategoryHandler{repo: repo}
}

type createCategoryRequest struct {
	Name  string  `json:"name" validate:"required,max=100"`
	Type  string  `json:"type" validate:"required,oneof=income expense"`
	Color *string `json:"color" validate:"omitempty,max=20"`
	Icon  *string `json:"icon" validate:"omitempty,max=50"`
}

type updateCategoryRequest struct {
	Name  string  `json:"name" validate:"required,max=100"`
	Color *string `json:"color" validate:"omitempty,max=20"`
	Icon  *string `json:"icon" validate:"omitempty,max=50"`
}

// List: GET /categories?type=income|expense
func (h *CategoryHandler) List(c *fiber.Ctx) error {
	typ := c.Query("type")
	if typ != "" && typ != "income" && typ != "expense" {
		return response.Error(c, fiber.StatusBadRequest, "type must be income or expense")
	}
	cats, err := h.repo.List(c.Context(), middleware.UserID(c), typ)
	if err != nil {
		return repoError(c, err)
	}
	return response.OK(c, cats)
}

func (h *CategoryHandler) Get(c *fiber.Ctx) error {
	id, ok, err := pathID(c)
	if !ok {
		return err
	}
	cat, err := h.repo.Get(c.Context(), middleware.UserID(c), id)
	if err != nil {
		return repoError(c, err)
	}
	return response.OK(c, cat)
}

func (h *CategoryHandler) Create(c *fiber.Ctx) error {
	var req createCategoryRequest
	if ok, err := middleware.BindAndValidate(c, &req); !ok {
		return err
	}
	cat, err := h.repo.Create(c.Context(), &models.Category{
		UserID: middleware.UserID(c), Name: req.Name, Type: req.Type, Color: req.Color, Icon: req.Icon,
	})
	if err != nil {
		return repoError(c, err)
	}
	return response.Created(c, cat)
}

func (h *CategoryHandler) Update(c *fiber.Ctx) error {
	id, ok, err := pathID(c)
	if !ok {
		return err
	}
	var req updateCategoryRequest
	if ok, err := middleware.BindAndValidate(c, &req); !ok {
		return err
	}
	cat, err := h.repo.Update(c.Context(), &models.Category{
		ID: id, UserID: middleware.UserID(c), Name: req.Name, Color: req.Color, Icon: req.Icon,
	})
	if err != nil {
		return repoError(c, err)
	}
	return response.OK(c, cat)
}

// Delete returns 409 while transactions or recurring items still use the category.
func (h *CategoryHandler) Delete(c *fiber.Ctx) error {
	id, ok, err := pathID(c)
	if !ok {
		return err
	}
	if err := h.repo.Delete(c.Context(), middleware.UserID(c), id); err != nil {
		return repoError(c, err)
	}
	return response.Message(c, "category deleted")
}
