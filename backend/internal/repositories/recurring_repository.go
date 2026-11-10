package repositories

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"money-manager/internal/models"
)

const dateLayout = "2006-01-02"

// Occurrence returns the n-th (0-based) date of a schedule. Monthly/yearly dates are
// computed from start each time and clamped to month end, so Jan 31 -> Feb 28 -> Mar 31.
func Occurrence(start time.Time, frequency string, n int) time.Time {
	switch frequency {
	case "daily":
		return start.AddDate(0, 0, n)
	case "weekly":
		return start.AddDate(0, 0, 7*n)
	case "yearly":
		return addMonthsClamped(start, 12*n)
	default: // monthly
		return addMonthsClamped(start, n)
	}
}

func addMonthsClamped(t time.Time, months int) time.Time {
	first := time.Date(t.Year(), t.Month()+time.Month(months), 1, 0, 0, 0, 0, time.UTC)
	lastDay := first.AddDate(0, 1, -1).Day()
	day := t.Day()
	if day > lastDay {
		day = lastDay
	}
	return time.Date(first.Year(), first.Month(), day, 0, 0, 0, 0, time.UTC)
}

type RecurringRepository struct{ db *pgxpool.Pool }

func NewRecurringRepository(db *pgxpool.Pool) *RecurringRepository {
	return &RecurringRepository{db: db}
}

const recurringSelect = `
	SELECT r.id, r.user_id, r.type, r.category_id, c.name, r.amount, r.note, r.frequency,
	       to_char(r.start_date, 'YYYY-MM-DD'), to_char(r.end_date, 'YYYY-MM-DD'), r.run_count,
	       to_char(r.next_run_date, 'YYYY-MM-DD'), r.active,
	       (SELECT COUNT(*) FROM transactions t WHERE t.recurring_id = r.id),
	       r.created_at, r.updated_at
	FROM recurring_transactions r
	JOIN categories c ON c.id = r.category_id`

func scanRecurring(row pgx.Row) (*models.RecurringTransaction, error) {
	r := &models.RecurringTransaction{}
	err := row.Scan(&r.ID, &r.UserID, &r.Type, &r.CategoryID, &r.CategoryName, &r.Amount, &r.Note,
		&r.Frequency, &r.StartDate, &r.EndDate, &r.RunCount, &r.NextRunDate, &r.Active,
		&r.GeneratedCount, &r.CreatedAt, &r.UpdatedAt)
	if err != nil {
		return nil, notFound(err)
	}
	return r, nil
}

func (r *RecurringRepository) List(ctx context.Context, userID string) ([]models.RecurringTransaction, error) {
	rows, err := r.db.Query(ctx, recurringSelect+` WHERE r.user_id = $1 ORDER BY r.active DESC, r.next_run_date`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []models.RecurringTransaction{}
	for rows.Next() {
		item, err := scanRecurring(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *item)
	}
	return out, rows.Err()
}

func (r *RecurringRepository) Get(ctx context.Context, userID, id string) (*models.RecurringTransaction, error) {
	return scanRecurring(r.db.QueryRow(ctx, recurringSelect+` WHERE r.user_id = $1 AND r.id = $2`, userID, id))
}

func (r *RecurringRepository) Create(ctx context.Context, m *models.RecurringTransaction) (*models.RecurringTransaction, error) {
	var id string
	err := r.db.QueryRow(ctx,
		`INSERT INTO recurring_transactions
		     (user_id, type, category_id, amount, note, frequency, start_date, end_date, next_run_date)
		 VALUES ($1, $2, $3, $4, $5, $6, $7::date, $8::date, $7::date) RETURNING id`,
		m.UserID, m.Type, m.CategoryID, m.Amount, m.Note, m.Frequency, m.StartDate, m.EndDate).Scan(&id)
	if isFKViolation(err) {
		return nil, ErrInvalidCategory
	}
	if err != nil {
		return nil, err
	}
	return r.Get(ctx, m.UserID, id)
}

// ResumeIndex returns the index of the first occurrence dated today or later, never below runCount.
// Used when a paused item is resumed, so the occurrences missed while paused are skipped
// instead of being back-filled.
func ResumeIndex(start time.Time, frequency string, runCount int, today time.Time) int {
	todayDate := time.Date(today.Year(), today.Month(), today.Day(), 0, 0, 0, 0, time.UTC)
	n := runCount
	for Occurrence(start, frequency, n).Before(todayDate) {
		n++
	}
	return n
}

// Update changes the template only; the schedule (frequency, start_date) is fixed after creation.
// Already-generated transactions are not touched. Resuming a paused item (active false -> true)
// skips the occurrences that fell due while it was paused.
func (r *RecurringRepository) Update(ctx context.Context, m *models.RecurringTransaction, today time.Time) (*models.RecurringTransaction, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var (
		wasActive bool
		start     time.Time
		frequency string
		runCount  int
	)
	err = tx.QueryRow(ctx,
		`SELECT active, start_date, frequency, run_count FROM recurring_transactions
		 WHERE user_id = $1 AND id = $2 FOR UPDATE`, m.UserID, m.ID).Scan(&wasActive, &start, &frequency, &runCount)
	if err != nil {
		return nil, notFound(err)
	}
	if !wasActive && m.Active {
		runCount = ResumeIndex(start, frequency, runCount, today)
	}

	_, err = tx.Exec(ctx,
		`UPDATE recurring_transactions
		 SET type = $3, category_id = $4, amount = $5, note = $6, end_date = $7::date, active = $8,
		     run_count = $9, next_run_date = $10, updated_at = now()
		 WHERE user_id = $1 AND id = $2`,
		m.UserID, m.ID, m.Type, m.CategoryID, m.Amount, m.Note, m.EndDate, m.Active,
		runCount, Occurrence(start, frequency, runCount))
	if isFKViolation(err) {
		return nil, ErrInvalidCategory
	}
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return r.Get(ctx, m.UserID, m.ID)
}

// Delete removes the template; transactions it already generated are kept.
func (r *RecurringRepository) Delete(ctx context.Context, userID, id string) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM recurring_transactions WHERE user_id = $1 AND id = $2`, userID, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// GenerateDue materializes every occurrence dated on or before today into transactions.
// Safe to run concurrently: rows are locked with SKIP LOCKED and UNIQUE(recurring_id, txn_date)
// prevents duplicates. Returns the number of transactions created.
func (r *RecurringRepository) GenerateDue(ctx context.Context, today time.Time) (int, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)

	type due struct {
		id, userID, typ, categoryID, frequency string
		amount                                 float64
		note                                   *string
		start                                  time.Time
		end                                    *time.Time
		runCount                               int
	}

	rows, err := tx.Query(ctx, `
		SELECT id, user_id, type, category_id, amount, note, frequency, start_date, end_date, run_count
		FROM recurring_transactions
		WHERE active AND next_run_date <= $1::date
		FOR UPDATE SKIP LOCKED`, today.Format(dateLayout))
	if err != nil {
		return 0, err
	}
	var items []due
	for rows.Next() {
		var d due
		if err := rows.Scan(&d.id, &d.userID, &d.typ, &d.categoryID, &d.amount, &d.note,
			&d.frequency, &d.start, &d.end, &d.runCount); err != nil {
			rows.Close()
			return 0, err
		}
		items = append(items, d)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return 0, err
	}

	todayDate := time.Date(today.Year(), today.Month(), today.Day(), 0, 0, 0, 0, time.UTC)
	created := 0
	for _, d := range items {
		n := d.runCount
		next := Occurrence(d.start, d.frequency, n)
		for !next.After(todayDate) && (d.end == nil || !next.After(*d.end)) {
			tag, err := tx.Exec(ctx,
				`INSERT INTO transactions (user_id, type, category_id, amount, txn_date, note, recurring_id)
				 VALUES ($1, $2, $3, $4, $5, $6, $7)
				 ON CONFLICT (recurring_id, txn_date) DO NOTHING`,
				d.userID, d.typ, d.categoryID, d.amount, next, d.note, d.id)
			if err != nil {
				return 0, err
			}
			created += int(tag.RowsAffected())
			n++
			next = Occurrence(d.start, d.frequency, n)
		}

		active := d.end == nil || !next.After(*d.end)
		if _, err := tx.Exec(ctx,
			`UPDATE recurring_transactions SET run_count = $2, next_run_date = $3, active = $4, updated_at = now()
			 WHERE id = $1`, d.id, n, next, active); err != nil {
			return 0, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return 0, err
	}
	return created, nil
}
