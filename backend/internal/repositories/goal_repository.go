package repositories

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"money-manager/internal/models"
)

// PayDay is the day salary arrives. Reports group by the pay period that ends in a month
// (month 2026-11 = 2026-10-25 .. 2026-11-24) and automatic goal deposits run on this day.
const PayDay = 25

// SavingsCategory is the expense category goal deposits are recorded in; created on first use.
const SavingsCategory = "ເງິນອອມ"

type GoalRepository struct{ db *pgxpool.Pool }

func NewGoalRepository(db *pgxpool.Pool) *GoalRepository { return &GoalRepository{db: db} }

const goalSelect = `
	SELECT g.id, g.user_id, g.name, g.target_amount, g.category_id,
	       COALESCE(d.saved, 0), COALESCE(d.n, 0),
	       r.amount, to_char(r.next_run_date, 'YYYY-MM-DD'),
	       g.created_at, g.updated_at
	FROM goals g
	LEFT JOIN LATERAL (
	    SELECT SUM(t.amount) AS saved, COUNT(*) AS n FROM transactions t WHERE t.goal_id = g.id
	) d ON true
	LEFT JOIN recurring_transactions r ON r.goal_id = g.id AND r.active`

func scanGoal(row pgx.Row) (*models.Goal, error) {
	g := &models.Goal{}
	err := row.Scan(&g.ID, &g.UserID, &g.Name, &g.TargetAmount, &g.CategoryID, &g.Saved, &g.DepositCount,
		&g.MonthlyAmount, &g.NextDeposit, &g.CreatedAt, &g.UpdatedAt)
	if err != nil {
		return nil, notFound(err)
	}
	return g, nil
}

func (r *GoalRepository) List(ctx context.Context, userID string) ([]models.Goal, error) {
	rows, err := r.db.Query(ctx, goalSelect+` WHERE g.user_id = $1 ORDER BY g.created_at`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.Goal{}
	for rows.Next() {
		g, err := scanGoal(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *g)
	}
	return out, rows.Err()
}

func (r *GoalRepository) Get(ctx context.Context, userID, id string) (*models.Goal, error) {
	return scanGoal(r.db.QueryRow(ctx, goalSelect+` WHERE g.user_id = $1 AND g.id = $2`, userID, id))
}

func goalNote(name string) *string {
	n := "ອອມ: " + name
	return &n
}

// Create saves the goal in the savings category (created if missing) and, when monthly is set,
// a monthly recurring deposit starting on start.
func (r *GoalRepository) Create(ctx context.Context, g *models.Goal, monthly *float64, start string) (*models.Goal, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var categoryID string
	if err := tx.QueryRow(ctx,
		`INSERT INTO categories (user_id, name, type, icon) VALUES ($1, $2, 'expense', 'savings')
		 ON CONFLICT (user_id, type, name) DO UPDATE SET name = EXCLUDED.name
		 RETURNING id`, g.UserID, SavingsCategory).Scan(&categoryID); err != nil {
		return nil, err
	}

	var id string
	err = tx.QueryRow(ctx,
		`INSERT INTO goals (user_id, name, target_amount, category_id) VALUES ($1, $2, $3, $4) RETURNING id`,
		g.UserID, g.Name, g.TargetAmount, categoryID).Scan(&id)
	if isUniqueViolation(err) {
		return nil, ErrDuplicate
	}
	if err != nil {
		return nil, err
	}

	if monthly != nil {
		if _, err := tx.Exec(ctx,
			`INSERT INTO recurring_transactions
			     (user_id, type, category_id, amount, note, frequency, start_date, next_run_date, goal_id)
			 VALUES ($1, 'expense', $2, $3, $4, 'monthly', $5::date, $5::date, $6)`,
			g.UserID, categoryID, *monthly, goalNote(g.Name), start, id); err != nil {
			return nil, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return r.Get(ctx, g.UserID, id)
}

// Update changes the name and target and sets, changes or removes the automatic deposit.
// An existing schedule keeps its dates (so a deposit already made today is not repeated);
// a paused one is resumed from the next payday.
func (r *GoalRepository) Update(ctx context.Context, g *models.Goal, monthly *float64, start string, today time.Time) (*models.Goal, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var categoryID string
	err = tx.QueryRow(ctx,
		`UPDATE goals SET name = $3, target_amount = $4, updated_at = now()
		 WHERE user_id = $1 AND id = $2 RETURNING category_id`,
		g.UserID, g.ID, g.Name, g.TargetAmount).Scan(&categoryID)
	if isUniqueViolation(err) {
		return nil, ErrDuplicate
	}
	if err != nil {
		return nil, notFound(err)
	}

	if monthly == nil {
		if _, err := tx.Exec(ctx, `DELETE FROM recurring_transactions WHERE user_id = $1 AND goal_id = $2`, g.UserID, g.ID); err != nil {
			return nil, err
		}
	} else {
		var (
			recID     string
			active    bool
			recStart  time.Time
			frequency string
			runCount  int
		)
		err := tx.QueryRow(ctx,
			`SELECT id, active, start_date, frequency, run_count FROM recurring_transactions
			 WHERE user_id = $1 AND goal_id = $2 FOR UPDATE`, g.UserID, g.ID).
			Scan(&recID, &active, &recStart, &frequency, &runCount)
		switch {
		case errors.Is(err, pgx.ErrNoRows):
			if _, err := tx.Exec(ctx,
				`INSERT INTO recurring_transactions
				     (user_id, type, category_id, amount, note, frequency, start_date, next_run_date, goal_id)
				 VALUES ($1, 'expense', $2, $3, $4, 'monthly', $5::date, $5::date, $6)`,
				g.UserID, categoryID, *monthly, goalNote(g.Name), start, g.ID); err != nil {
				return nil, err
			}
		case err != nil:
			return nil, err
		default:
			if !active {
				runCount = ResumeIndex(recStart, frequency, runCount, today)
			}
			if _, err := tx.Exec(ctx,
				`UPDATE recurring_transactions
				 SET amount = $2, note = $3, active = true, end_date = NULL, run_count = $4, next_run_date = $5,
				     updated_at = now()
				 WHERE id = $1`,
				recID, *monthly, goalNote(g.Name), runCount, Occurrence(recStart, frequency, runCount)); err != nil {
				return nil, err
			}
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return r.Get(ctx, g.UserID, g.ID)
}

// Delete removes the goal and its automatic deposit; past deposits stay as expenses.
func (r *GoalRepository) Delete(ctx context.Context, userID, id string) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM goals WHERE user_id = $1 AND id = $2`, userID, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// ---- favorites ----

type FavoriteRepository struct{ db *pgxpool.Pool }

func NewFavoriteRepository(db *pgxpool.Pool) *FavoriteRepository { return &FavoriteRepository{db: db} }

// MaxFavorites keeps the row on the entry page short.
const MaxFavorites = 20

// ErrTooMany means a per-user limit was reached.
var ErrTooMany = errors.New("limit reached")

const favoriteSelect = `
	SELECT f.id, f.user_id, f.type, f.category_id, c.name, f.amount, f.note, f.created_at
	FROM favorites f
	JOIN categories c ON c.id = f.category_id`

func scanFavorite(row pgx.Row) (*models.Favorite, error) {
	f := &models.Favorite{}
	err := row.Scan(&f.ID, &f.UserID, &f.Type, &f.CategoryID, &f.CategoryName, &f.Amount, &f.Note, &f.CreatedAt)
	if err != nil {
		return nil, notFound(err)
	}
	return f, nil
}

func (r *FavoriteRepository) List(ctx context.Context, userID string) ([]models.Favorite, error) {
	rows, err := r.db.Query(ctx, favoriteSelect+` WHERE f.user_id = $1 ORDER BY f.created_at`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.Favorite{}
	for rows.Next() {
		f, err := scanFavorite(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *f)
	}
	return out, rows.Err()
}

func (r *FavoriteRepository) Create(ctx context.Context, f *models.Favorite) (*models.Favorite, error) {
	var n int
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM favorites WHERE user_id = $1`, f.UserID).Scan(&n); err != nil {
		return nil, err
	}
	if n >= MaxFavorites {
		return nil, ErrTooMany
	}
	var id string
	err := r.db.QueryRow(ctx,
		`INSERT INTO favorites (user_id, type, category_id, amount, note) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
		f.UserID, f.Type, f.CategoryID, f.Amount, f.Note).Scan(&id)
	if isFKViolation(err) {
		return nil, ErrInvalidCategory
	}
	if err != nil {
		return nil, err
	}
	return scanFavorite(r.db.QueryRow(ctx, favoriteSelect+` WHERE f.id = $1`, id))
}

func (r *FavoriteRepository) Delete(ctx context.Context, userID, id string) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM favorites WHERE user_id = $1 AND id = $2`, userID, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
