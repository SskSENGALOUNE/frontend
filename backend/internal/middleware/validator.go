package middleware

import (
	"errors"
	"fmt"
	"reflect"
	"strings"

	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v2"

	"money-manager/pkg/response"
)

var validate = func() *validator.Validate {
	v := validator.New()
	// Report errors using the json field name (e.g. "account_id") instead of the Go field name.
	v.RegisterTagNameFunc(func(f reflect.StructField) string {
		name, _, _ := strings.Cut(f.Tag.Get("json"), ",")
		if name == "" || name == "-" {
			return f.Name
		}
		return name
	})
	return v
}()

// BindAndValidate parses the JSON body into dst and runs struct validation.
// On failure it writes the error response and returns ok=false.
func BindAndValidate(c *fiber.Ctx, dst interface{}) (bool, error) {
	if err := c.BodyParser(dst); err != nil {
		return false, response.Error(c, fiber.StatusBadRequest, "invalid request body")
	}
	if err := validate.Struct(dst); err != nil {
		var ve validator.ValidationErrors
		if errors.As(err, &ve) {
			fields := make(map[string]string, len(ve))
			for _, fe := range ve {
				fields[fe.Field()] = fe.Tag()
			}
			return false, response.ValidationError(c, fields)
		}
		return false, response.Error(c, fiber.StatusBadRequest, err.Error())
	}
	return true, nil
}

// BindAndValidateList parses a JSON array body into dst (a pointer to a slice of structs),
// checks its length is within [1, max] and validates every element.
// Field errors are keyed by position, e.g. "[2].amount".
func BindAndValidateList[T any](c *fiber.Ctx, dst *[]T, max int) (bool, error) {
	if err := c.BodyParser(dst); err != nil {
		return false, response.Error(c, fiber.StatusBadRequest, "request body must be a JSON array")
	}
	if len(*dst) == 0 || len(*dst) > max {
		return false, response.Error(c, fiber.StatusBadRequest, fmt.Sprintf("array must have 1 to %d items", max))
	}
	fields := map[string]string{}
	for i := range *dst {
		if err := validate.Struct(&(*dst)[i]); err != nil {
			var ve validator.ValidationErrors
			if !errors.As(err, &ve) {
				return false, response.Error(c, fiber.StatusBadRequest, err.Error())
			}
			for _, fe := range ve {
				fields[fmt.Sprintf("[%d].%s", i, fe.Field())] = fe.Tag()
			}
		}
	}
	if len(fields) > 0 {
		return false, response.ValidationError(c, fields)
	}
	return true, nil
}
