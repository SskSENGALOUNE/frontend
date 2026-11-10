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

const userCols = `id, name, email, password_hash, currency, created_at, updated_at`

func scanUser(row pgx.Row) (*models.User, error) {
	u := &models.User{}
	err := row.Scan(&u.ID, &u.Name, &u.Email, &u.PasswordHash, &u.Currency, &u.CreatedAt, &u.UpdatedAt)
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

func (r *UserRepository) Update(ctx context.Context, id, name, currency string) (*models.User, error) {
	return scanUser(r.db.QueryRow(ctx,
		`UPDATE users SET name = $2, currency = $3, updated_at = now() WHERE id = $1 RETURNING `+userCols,
		id, name, currency))
}

func (r *UserRepository) UpdatePassword(ctx context.Context, id, passwordHash string) error {
	_, err := r.db.Exec(ctx,
		`UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1`, id, passwordHash)
	return err
}
