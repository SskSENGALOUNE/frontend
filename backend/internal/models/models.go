package models

import "time"

// Dates (txn_date, start_date, month ...) are exchanged as "YYYY-MM-DD" strings.

type User struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	Currency     string    `json:"currency"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type Category struct {
	ID        string    `json:"id"`
	UserID    string    `json:"-"`
	Name      string    `json:"name"`
	Type      string    `json:"type"`
	Color     *string   `json:"color"`
	Icon      *string   `json:"icon"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Transaction struct {
	ID            string    `json:"id"`
	UserID        string    `json:"-"`
	Type          string    `json:"type"`
	CategoryID    string    `json:"category_id"`
	CategoryName  string    `json:"category_name"`
	CategoryColor *string   `json:"category_color"`
	CategoryIcon  *string   `json:"category_icon"`
	Amount        float64   `json:"amount"`
	TxnDate       string    `json:"txn_date"`
	Note          *string   `json:"note"`
	RecurringID   *string   `json:"recurring_id"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type TransactionFilter struct {
	Type       string
	CategoryID string
	From       string
	To         string // inclusive
	Search     string
	Limit      int
	Offset     int
}

type RecurringTransaction struct {
	ID           string  `json:"id"`
	UserID       string  `json:"-"`
	Type         string  `json:"type"`
	CategoryID   string  `json:"category_id"`
	CategoryName string  `json:"category_name"`
	Amount       float64 `json:"amount"`
	Note         *string `json:"note"`
	Frequency    string  `json:"frequency"`
	StartDate    string  `json:"start_date"`
	EndDate      *string `json:"end_date"`
	RunCount     int     `json:"run_count"` // position in the schedule (includes skipped occurrences)
	NextRunDate  string  `json:"next_run_date"`
	// GeneratedCount is how many transactions this item has created that still exist.
	GeneratedCount int       `json:"generated_count"`
	Active         bool      `json:"active"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type Budget struct {
	ID           string    `json:"id"`
	UserID       string    `json:"-"`
	CategoryID   string    `json:"category_id"`
	CategoryName string    `json:"category_name"`
	Month        string    `json:"month"`
	Amount       float64   `json:"amount"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type Summary struct {
	Income          float64 `json:"income"`
	Expense         float64 `json:"expense"`
	Net             float64 `json:"net"`
	IncomeCount     int     `json:"income_count"`
	ExpenseCount    int     `json:"expense_count"`
	AvgDailyExpense float64 `json:"avg_daily_expense"`
	Days            int     `json:"days"`
}

type CategoryTotal struct {
	CategoryID   string  `json:"category_id"`
	CategoryName string  `json:"category_name"`
	Color        *string `json:"color"`
	Icon         *string `json:"icon"`
	Total        float64 `json:"total"`
	Count        int     `json:"count"`
	Percent      float64 `json:"percent"`
}

type PeriodTotal struct {
	Period  string  `json:"period"`
	Income  float64 `json:"income"`
	Expense float64 `json:"expense"`
	Net     float64 `json:"net"`
}

type BudgetStatus struct {
	BudgetID     string  `json:"budget_id"`
	CategoryID   string  `json:"category_id"`
	CategoryName string  `json:"category_name"`
	Color        *string `json:"color"`
	Icon         *string `json:"icon"`
	Budget       float64 `json:"budget"`
	Spent        float64 `json:"spent"`
	Remaining    float64 `json:"remaining"`
	Percent      float64 `json:"percent"`
	OverBudget   bool    `json:"over_budget"`
}
