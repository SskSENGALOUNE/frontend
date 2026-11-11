package repositories

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"money-manager/internal/models"
)

// ErrInvalidCategory means the category is missing, not owned by the user, or its type
// does not match. The composite FK (category_id, user_id, type) enforces this in the DB.
var ErrInvalidCategory = errors.New("invalid category")

func isFKViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23503"
}

type TransactionRepository struct{ db *pgxpool.Pool }

func NewTransactionRepository(db *pgxpool.Pool) *TransactionRepository {
	return &TransactionRepository{db: db}
}

const transactionSelect = `
	SELECT t.id, t.user_id, t.type, t.category_id, c.name, c.color, c.icon, t.amount,
	       to_char(t.txn_date, 'YYYY-MM-DD'), t.note, t.recurring_id, t.goal_id, t.created_at, t.updated_at
	FROM transactions t
	JOIN categories c ON c.id = t.category_id`

func scanTransaction(row pgx.Row) (*models.Transaction, error) {
	t := &models.Transaction{}
	err := row.Scan(&t.ID, &t.UserID, &t.Type, &t.CategoryID, &t.CategoryName, &t.CategoryColor,
		&t.CategoryIcon, &t.Amount, &t.TxnDate, &t.Note, &t.RecurringID, &t.GoalID, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return nil, notFound(err)
	}
	return t, nil
}

func buildFilter(userID string, f models.TransactionFilter) (string, []interface{}) {
	where := []string{"t.user_id = $1"}
	args := []interface{}{userID}
	add := func(cond string, v interface{}) {
		args = append(args, v)
		where = append(where, fmt.Sprintf(cond, len(args)))
	}

	if f.Type != "" {
		add("t.type = $%d", f.Type)
	}
	if f.CategoryID != "" {
		add("t.category_id = $%d", f.CategoryID)
	}
	if f.From != "" {
		add("t.txn_date >= $%d::date", f.From)
	}
	if f.To != "" {
		add("t.txn_date <= $%d::date", f.To)
	}
	if f.Search != "" {
		add("t.note ILIKE $%d", "%"+f.Search+"%")
	}
	return " WHERE " + strings.Join(where, " AND "), args
}

type TransactionPage struct {
	Items   []models.Transaction
	Total   int
	Income  float64
	Expense float64
}

// List returns one page plus totals over the whole filtered set.
func (r *TransactionRepository) List(ctx context.Context, userID string, f models.TransactionFilter) (*TransactionPage, error) {
	where, args := buildFilter(userID, f)
	p := &TransactionPage{Items: []models.Transaction{}}

	if err := r.db.QueryRow(ctx, `
		SELECT COUNT(*),
		       COALESCE(SUM(amount) FILTER (WHERE type = 'income'), 0),
		       COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0)
		FROM transactions t`+where, args...).Scan(&p.Total, &p.Income, &p.Expense); err != nil {
		return nil, err
	}

	args = append(args, f.Limit, f.Offset)
	rows, err := r.db.Query(ctx,
		transactionSelect+where+fmt.Sprintf(` ORDER BY t.txn_date DESC, t.created_at DESC LIMIT $%d OFFSET $%d`,
			len(args)-1, len(args)), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		t, err := scanTransaction(rows)
		if err != nil {
			return nil, err
		}
		p.Items = append(p.Items, *t)
	}
	return p, rows.Err()
}

func (r *TransactionRepository) Get(ctx context.Context, userID, id string) (*models.Transaction, error) {
	return scanTransaction(r.db.QueryRow(ctx, transactionSelect+` WHERE t.user_id = $1 AND t.id = $2`, userID, id))
}

func (r *TransactionRepository) Create(ctx context.Context, t *models.Transaction) (*models.Transaction, error) {
	var id string
	err := r.db.QueryRow(ctx,
		`INSERT INTO transactions (user_id, type, category_id, amount, txn_date, note, goal_id)
		 VALUES ($1, $2, $3, $4, $5::date, $6, $7) RETURNING id`,
		t.UserID, t.Type, t.CategoryID, t.Amount, t.TxnDate, t.Note, t.GoalID).Scan(&id)
	if isFKViolation(err) {
		return nil, ErrInvalidCategory
	}
	if err != nil {
		return nil, err
	}
	return r.Get(ctx, t.UserID, id)
}

func (r *TransactionRepository) Update(ctx context.Context, t *models.Transaction) (*models.Transaction, error) {
	tag, err := r.db.Exec(ctx,
		`UPDATE transactions SET type = $3, category_id = $4, amount = $5, txn_date = $6::date,
		        note = $7, updated_at = now()
		 WHERE user_id = $1 AND id = $2`,
		t.UserID, t.ID, t.Type, t.CategoryID, t.Amount, t.TxnDate, t.Note)
	if isFKViolation(err) {
		return nil, ErrInvalidCategory
	}
	if err != nil {
		return nil, err
	}
	if tag.RowsAffected() == 0 {
		return nil, ErrNotFound
	}
	return r.Get(ctx, t.UserID, t.ID)
}

func (r *TransactionRepository) Delete(ctx context.Context, userID, id string) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM transactions WHERE user_id = $1 AND id = $2`, userID, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// InvalidItemsError lists the positions in a batch whose category is missing,
// not owned by the user, or of the wrong type.
type InvalidItemsError struct{ Indexes []int }

func (e *InvalidItemsError) Error() string {
	return fmt.Sprintf("invalid category at items %v", e.Indexes)
}

// CreateMany inserts all items in one DB transaction (all or nothing) and returns them in input order.
func (r *TransactionRepository) CreateMany(ctx context.Context, userID string, items []models.Transaction) ([]models.Transaction, error) {
	ids := make([]string, len(items))
	for i, it := range items {
		ids[i] = it.CategoryID
	}
	rows, err := r.db.Query(ctx,
		`SELECT id::text, type FROM categories WHERE user_id = $1 AND id = ANY($2::uuid[])`, userID, ids)
	if err != nil {
		return nil, err
	}
	catType := map[string]string{}
	for rows.Next() {
		var id, typ string
		if err := rows.Scan(&id, &typ); err != nil {
			rows.Close()
			return nil, err
		}
		catType[id] = typ
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	var bad []int
	for i, it := range items {
		if catType[strings.ToLower(it.CategoryID)] != it.Type {
			bad = append(bad, i)
		}
	}
	if len(bad) > 0 {
		return nil, &InvalidItemsError{Indexes: bad}
	}

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	batch := &pgx.Batch{}
	for _, it := range items {
		batch.Queue(
			`INSERT INTO transactions (user_id, type, category_id, amount, txn_date, note)
			 VALUES ($1, $2, $3, $4, $5::date, $6) RETURNING id`,
			userID, it.Type, it.CategoryID, it.Amount, it.TxnDate, it.Note)
	}
	br := tx.SendBatch(ctx, batch)
	newIDs := make([]string, len(items))
	for i := range items {
		if err := br.QueryRow().Scan(&newIDs[i]); err != nil {
			br.Close()
			if isFKViolation(err) {
				return nil, ErrInvalidCategory
			}
			return nil, err
		}
	}
	if err := br.Close(); err != nil {
		return nil, err
	}

	// Read back inside the same transaction so joins see the new rows before commit.
	rows, err = tx.Query(ctx, transactionSelect+` WHERE t.user_id = $1 AND t.id = ANY($2::uuid[])`, userID, newIDs)
	if err != nil {
		return nil, err
	}
	byID := make(map[string]models.Transaction, len(newIDs))
	for rows.Next() {
		t, err := scanTransaction(rows)
		if err != nil {
			rows.Close()
			return nil, err
		}
		byID[t.ID] = *t
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	out := make([]models.Transaction, len(newIDs))
	for i, id := range newIDs {
		out[i] = byID[id]
	}
	return out, nil
}
