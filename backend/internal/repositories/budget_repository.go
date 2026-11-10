package repositories

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"money-manager/internal/models"
)

type BudgetRepository struct{ db *pgxpool.Pool }

func NewBudgetRepository(db *pgxpool.Pool) *BudgetRepository { return &BudgetRepository{db: db} }

const budgetSelect = `
	SELECT b.id, b.user_id, b.category_id, c.name, to_char(b.month, 'YYYY-MM-DD'), b.amount,
	       b.created_at, b.updated_at
	FROM budgets b
	JOIN categories c ON c.id = b.category_id`

func scanBudget(row pgx.Row) (*models.Budget, error) {
	b := &models.Budget{}
	err := row.Scan(&b.ID, &b.UserID, &b.CategoryID, &b.CategoryName, &b.Month, &b.Amount,
		&b.CreatedAt, &b.UpdatedAt)
	if err != nil {
		return nil, notFound(err)
	}
	return b, nil
}

// List returns budgets for one month (first day of month, "YYYY-MM-01").
func (r *BudgetRepository) List(ctx context.Context, userID, month string) ([]models.Budget, error) {
	rows, err := r.db.Query(ctx, budgetSelect+` WHERE b.user_id = $1 AND b.month = $2::date ORDER BY c.name`,
		userID, month)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []models.Budget{}
	for rows.Next() {
		b, err := scanBudget(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *b)
	}
	return out, rows.Err()
}

// Upsert sets the budget for (category, month), creating or replacing it.
func (r *BudgetRepository) Upsert(ctx context.Context, b *models.Budget) (*models.Budget, error) {
	var id string
	err := r.db.QueryRow(ctx,
		`INSERT INTO budgets (user_id, category_id, month, amount) VALUES ($1, $2, $3::date, $4)
		 ON CONFLICT (user_id, category_id, month)
		 DO UPDATE SET amount = EXCLUDED.amount, updated_at = now()
		 RETURNING id`,
		b.UserID, b.CategoryID, b.Month, b.Amount).Scan(&id)
	if isFKViolation(err) {
		return nil, ErrInvalidCategory
	}
	if err != nil {
		return nil, err
	}
	return scanBudget(r.db.QueryRow(ctx, budgetSelect+` WHERE b.id = $1`, id))
}

// CopyMonth copies all budgets from one month to another, keeping any that already exist in the target.
func (r *BudgetRepository) CopyMonth(ctx context.Context, userID, from, to string) (int, error) {
	tag, err := r.db.Exec(ctx,
		`INSERT INTO budgets (user_id, category_id, month, amount)
		 SELECT user_id, category_id, $3::date, amount FROM budgets WHERE user_id = $1 AND month = $2::date
		 ON CONFLICT (user_id, category_id, month) DO NOTHING`,
		userID, from, to)
	if err != nil {
		return 0, err
	}
	return int(tag.RowsAffected()), nil
}

func (r *BudgetRepository) Delete(ctx context.Context, userID, id string) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM budgets WHERE user_id = $1 AND id = $2`, userID, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
