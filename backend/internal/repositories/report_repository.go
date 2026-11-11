package repositories

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"

	"money-manager/internal/models"
)

// All date ranges are inclusive "YYYY-MM-DD" strings: from <= txn_date <= to.
type ReportRepository struct{ db *pgxpool.Pool }

func NewReportRepository(db *pgxpool.Pool) *ReportRepository { return &ReportRepository{db: db} }

func (r *ReportRepository) Summary(ctx context.Context, userID, from, to string) (*models.Summary, error) {
	s := &models.Summary{}
	err := r.db.QueryRow(ctx, `
		SELECT COALESCE(SUM(amount) FILTER (WHERE type = 'income'), 0),
		       COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0),
		       COUNT(*) FILTER (WHERE type = 'income'),
		       COUNT(*) FILTER (WHERE type = 'expense'),
		       ($3::date - $2::date) + 1
		FROM transactions
		WHERE user_id = $1 AND txn_date BETWEEN $2::date AND $3::date`,
		userID, from, to).Scan(&s.Income, &s.Expense, &s.IncomeCount, &s.ExpenseCount, &s.Days)
	if err != nil {
		return nil, err
	}
	s.Net = s.Income - s.Expense
	if s.Days > 0 {
		s.AvgDailyExpense = s.Expense / float64(s.Days)
	}
	return s, nil
}

func (r *ReportRepository) ByCategory(ctx context.Context, userID, typ, from, to string) ([]models.CategoryTotal, error) {
	rows, err := r.db.Query(ctx, `
		SELECT c.id, c.name, c.color, c.icon, SUM(t.amount), COUNT(*),
		       ROUND(SUM(t.amount) * 100 / NULLIF(SUM(SUM(t.amount)) OVER (), 0), 2)
		FROM transactions t
		JOIN categories c ON c.id = t.category_id
		WHERE t.user_id = $1 AND t.type = $2 AND t.txn_date BETWEEN $3::date AND $4::date
		GROUP BY c.id, c.name, c.color, c.icon
		ORDER BY SUM(t.amount) DESC`,
		userID, typ, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []models.CategoryTotal{}
	for rows.Next() {
		var ct models.CategoryTotal
		if err := rows.Scan(&ct.CategoryID, &ct.CategoryName, &ct.Color, &ct.Icon, &ct.Total, &ct.Count, &ct.Percent); err != nil {
			return nil, err
		}
		out = append(out, ct)
	}
	return out, rows.Err()
}

// Trend returns one row per day or per pay period in the range, including periods with no
// transactions. A pay period is named after the month it ends in ("2026-11" = Oct 25 .. Nov 24).
func (r *ReportRepository) Trend(ctx context.Context, userID, period, from, to string) ([]models.PeriodTotal, error) {
	// bucket maps a date to the first day of its day or pay-period month.
	bucket, step, format := "%s::date", "1 day", "YYYY-MM-DD"
	if period == "month" {
		bucket = fmt.Sprintf("date_trunc('month', %%s - INTERVAL '%d days' + INTERVAL '1 month')::date", PayDay-1)
		step, format = "1 month", "YYYY-MM"
	}
	b := func(expr string) string { return fmt.Sprintf(bucket, expr) }
	rows, err := r.db.Query(ctx, `
		WITH periods AS (
		    SELECT generate_series(`+b("$2::date")+`, `+b("$3::date")+`, $4::interval)::date AS p
		)
		SELECT to_char(p.p, $5::text),
		       COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'income'), 0),
		       COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'expense'), 0)
		FROM periods p
		LEFT JOIN transactions t
		       ON t.user_id = $1
		      AND `+b("t.txn_date")+` = p.p
		      AND t.txn_date BETWEEN $2::date AND $3::date
		GROUP BY p.p
		ORDER BY p.p`,
		userID, from, to, step, format)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []models.PeriodTotal{}
	for rows.Next() {
		var pt models.PeriodTotal
		if err := rows.Scan(&pt.Period, &pt.Income, &pt.Expense); err != nil {
			return nil, err
		}
		pt.Net = pt.Income - pt.Expense
		out = append(out, pt)
	}
	return out, rows.Err()
}

// FrequentAmounts returns, per category, the (up to) limit amounts used most often since `since`,
// ties broken by the most recently used; each list is sorted smallest first.
func (r *ReportRepository) FrequentAmounts(ctx context.Context, userID, since string, limit int) ([]models.FrequentAmounts, error) {
	rows, err := r.db.Query(ctx, `
		SELECT category_id, array_agg(amount ORDER BY amount) FROM (
		    SELECT category_id, amount,
		           ROW_NUMBER() OVER (PARTITION BY category_id ORDER BY COUNT(*) DESC, MAX(txn_date) DESC, amount) AS rn
		    FROM transactions
		    WHERE user_id = $1 AND txn_date >= $2::date
		    GROUP BY category_id, amount
		) s
		WHERE rn <= $3
		GROUP BY category_id`,
		userID, since, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []models.FrequentAmounts{}
	for rows.Next() {
		var f models.FrequentAmounts
		if err := rows.Scan(&f.CategoryID, &f.Amounts); err != nil {
			return nil, err
		}
		out = append(out, f)
	}
	return out, rows.Err()
}

// BudgetStatus compares each budget of the month with the actual spending in that category
// between from and to (the month's pay period).
func (r *ReportRepository) BudgetStatus(ctx context.Context, userID, month, from, to string) ([]models.BudgetStatus, error) {
	rows, err := r.db.Query(ctx, `
		SELECT * FROM (
		    SELECT b.id, c.id, c.name, c.color, c.icon, b.amount,
		           COALESCE((
		               SELECT SUM(t.amount) FROM transactions t
		               WHERE t.user_id = b.user_id AND t.category_id = b.category_id
		                 AND t.txn_date BETWEEN $3::date AND $4::date
		           ), 0) AS spent
		    FROM budgets b
		    JOIN categories c ON c.id = b.category_id
		    WHERE b.user_id = $1 AND b.month = $2::date
		) s
		ORDER BY s.spent / s.amount DESC`,
		userID, month, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []models.BudgetStatus{}
	for rows.Next() {
		var s models.BudgetStatus
		if err := rows.Scan(&s.BudgetID, &s.CategoryID, &s.CategoryName, &s.Color, &s.Icon, &s.Budget, &s.Spent); err != nil {
			return nil, err
		}
		s.Remaining = s.Budget - s.Spent
		s.Percent = float64(int(s.Spent/s.Budget*10000+0.5)) / 100
		s.OverBudget = s.Spent > s.Budget
		out = append(out, s)
	}
	return out, rows.Err()
}
