package repositories

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"money-manager/internal/models"
)

var (
	ErrNotFound  = errors.New("not found")
	ErrDuplicate = errors.New("already exists")
	ErrInUse     = errors.New("in use")
)

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

func notFound(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	return err
}

type UserRepository struct{ db *pgxpool.Pool }

func NewUserRepository(db *pgxpool.Pool) *UserRepository { return &UserRepository{db: db} }

const userCols = `id, name, email, password_hash, currency, pay_day, created_at, updated_at`

func scanUser(row pgx.Row) (*models.User, error) {
	u := &models.User{}
	err := row.Scan(&u.ID, &u.Name, &u.Email, &u.PasswordHash, &u.Currency, &u.PayDay, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, notFound(err)
	}
	return u, nil
}

// Create inserts the user and seeds default categories in one transaction.
func (r *UserRepository) Create(ctx context.Context, name, email, passwordHash, currency string) (*models.User, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	u, err := scanUser(tx.QueryRow(ctx,
		`INSERT INTO users (name, email, password_hash, currency) VALUES ($1, $2, $3, $4)
		 RETURNING `+userCols, name, email, passwordHash, currency))
	if err != nil {
		if isUniqueViolation(err) {
			return nil, ErrDuplicate
		}
		return nil, err
	}

	defaults := []struct{ name, typ, icon string }{
		{"ເງິນເດືອນ", "income", "briefcase"},
		{"ເງິນໂບນັດ", "income", "gift"},
		{"ລາຍຮັບອື່ນໆ", "income", "plus"},
		{"ອາຫານ ແລະ ເຄື່ອງດື່ມ", "expense", "utensils"},
		{"ຄ່າເດີນທາງ", "expense", "car"},
		{"ຊື້ເຄື່ອງ", "expense", "bag"},
		{"ຄ່ານ້ຳ ຄ່າໄຟ ຄ່າໂທ", "expense", "receipt"},
		{"ສຸຂະພາບ", "expense", "heart"},
		{"ບັນເທີງ", "expense", "film"},
		{"ການສຶກສາ", "expense", "book"},
		{"ລາຍຈ່າຍອື່ນໆ", "expense", "dots"},
	}
	for _, d := range defaults {
		if _, err := tx.Exec(ctx,
			`INSERT INTO categories (user_id, name, type, icon) VALUES ($1, $2, $3, $4)`,
			u.ID, d.name, d.typ, d.icon); err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return u, nil
}

func (r *UserRepository) FindByEmail(ctx context.Context, email string) (*models.User, error) {
	return scanUser(r.db.QueryRow(ctx, `SELECT `+userCols+` FROM users WHERE email = $1`, email))
}

func (r *UserRepository) FindByID(ctx context.Context, id string) (*models.User, error) {
	return scanUser(r.db.QueryRow(ctx, `SELECT `+userCols+` FROM users WHERE id = $1`, id))
}

// Update changes the profile. payDay nil keeps the current one. When the pay day changes,
// automatic goal deposits move to the new day, starting from nextPayday (the first new payday).
func (r *UserRepository) Update(ctx context.Context, id, name, currency string, payDay *int, nextPayday func(day int) string) (*models.User, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var oldDay int
	if err := tx.QueryRow(ctx, `SELECT pay_day FROM users WHERE id = $1 FOR UPDATE`, id).Scan(&oldDay); err != nil {
		return nil, notFound(err)
	}
	u, err := scanUser(tx.QueryRow(ctx,
		`UPDATE users SET name = $2, currency = $3, pay_day = COALESCE($4, pay_day), updated_at = now()
		 WHERE id = $1 RETURNING `+userCols,
		id, name, currency, payDay))
	if err != nil {
		return nil, err
	}
	if u.PayDay != oldDay {
		next := nextPayday(u.PayDay)
		if _, err := tx.Exec(ctx,
			`UPDATE recurring_transactions
			 SET start_date = $2::date, next_run_date = $2::date, run_count = 0, updated_at = now()
			 WHERE user_id = $1 AND goal_id IS NOT NULL AND active`, id, next); err != nil {
			return nil, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return u, nil
}

// PayDay returns the user's pay-period start day.
func (r *UserRepository) PayDay(ctx context.Context, id string) (int, error) {
	var d int
	err := r.db.QueryRow(ctx, `SELECT pay_day FROM users WHERE id = $1`, id).Scan(&d)
	return d, notFound(err)
}

func (r *UserRepository) UpdatePassword(ctx context.Context, id, passwordHash string) error {
	_, err := r.db.Exec(ctx,
		`UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1`, id, passwordHash)
	return err
}
