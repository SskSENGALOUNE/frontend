package repositories

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"money-manager/internal/models"
)

type CategoryRepository struct{ db *pgxpool.Pool }

func NewCategoryRepository(db *pgxpool.Pool) *CategoryRepository { return &CategoryRepository{db: db} }

const categoryCols = `id, user_id, name, type, color, icon, created_at, updated_at`

func scanCategory(row pgx.Row) (*models.Category, error) {
	c := &models.Category{}
	err := row.Scan(&c.ID, &c.UserID, &c.Name, &c.Type, &c.Color, &c.Icon, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		return nil, notFound(err)
	}
	return c, nil
}

// List returns the user's categories; typ filters by "income"/"expense" when non-empty.
func (r *CategoryRepository) List(ctx context.Context, userID, typ string) ([]models.Category, error) {
	rows, err := r.db.Query(ctx,
		`SELECT `+categoryCols+` FROM categories
		 WHERE user_id = $1 AND ($2 = '' OR type = $2) ORDER BY type, name`, userID, typ)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []models.Category{}
	for rows.Next() {
		c, err := scanCategory(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *c)
	}
	return out, rows.Err()
}

func (r *CategoryRepository) Get(ctx context.Context, userID, id string) (*models.Category, error) {
	return scanCategory(r.db.QueryRow(ctx,
		`SELECT `+categoryCols+` FROM categories WHERE user_id = $1 AND id = $2`, userID, id))
}

func (r *CategoryRepository) Create(ctx context.Context, c *models.Category) (*models.Category, error) {
	out, err := scanCategory(r.db.QueryRow(ctx,
		`INSERT INTO categories (user_id, name, type, color, icon) VALUES ($1, $2, $3, $4, $5)
		 RETURNING `+categoryCols, c.UserID, c.Name, c.Type, c.Color, c.Icon))
	if isUniqueViolation(err) {
		return nil, ErrDuplicate
	}
	return out, err
}

// Update changes name/color/icon only; the type is fixed so existing transactions stay consistent.
func (r *CategoryRepository) Update(ctx context.Context, c *models.Category) (*models.Category, error) {
	out, err := scanCategory(r.db.QueryRow(ctx,
		`UPDATE categories SET name = $3, color = $4, icon = $5, updated_at = now()
		 WHERE user_id = $1 AND id = $2 RETURNING `+categoryCols,
		c.UserID, c.ID, c.Name, c.Color, c.Icon))
	if isUniqueViolation(err) {
		return nil, ErrDuplicate
	}
	return out, err
}

// Delete fails with ErrInUse while transactions or recurring items still reference the category.
func (r *CategoryRepository) Delete(ctx context.Context, userID, id string) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM categories WHERE user_id = $1 AND id = $2`, userID, id)
	if isFKViolation(err) {
		return ErrInUse
	}
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
