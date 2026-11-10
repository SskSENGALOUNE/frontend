package response

import "github.com/gofiber/fiber/v2"

type Body struct {
	Success bool        `json:"success"`
	Message string      `json:"message,omitempty"`
	Data    interface{} `json:"data,omitempty"`
	Errors  interface{} `json:"errors,omitempty"`
}

func OK(c *fiber.Ctx, data interface{}) error {
	return c.JSON(Body{Success: true, Data: data})
}

func Created(c *fiber.Ctx, data interface{}) error {
	return c.Status(fiber.StatusCreated).JSON(Body{Success: true, Data: data})
}

func Message(c *fiber.Ctx, msg string) error {
	return c.JSON(Body{Success: true, Message: msg})
}

func Error(c *fiber.Ctx, status int, msg string) error {
	return c.Status(status).JSON(Body{Success: false, Message: msg})
}

func ValidationError(c *fiber.Ctx, errs interface{}) error {
	return c.Status(fiber.StatusUnprocessableEntity).JSON(Body{Success: false, Message: "validation failed", Errors: errs})
}
