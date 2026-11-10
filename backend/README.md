# Money Manager API

Income / expense tracking with budgets, recurring entries and reports.
Go Fiber v2 + PostgreSQL (pgx v5).

## Run

```bash
cp .env.example .env   # set DB_PASSWORD and JWT_SECRET
go run ./cmd/server
```

On startup it creates the `money_manager` database if missing, applies `internal/migrations/sql/*.sql`,
and starts a worker that generates due recurring transactions (at startup, then hourly).
A new user gets default income/expense categories.

## Schema

| Table | Purpose |
|---|---|
| `users` | login, currency |
| `categories` | per-user income/expense categories |
| `transactions` | income/expense entry, `txn_date` is a DATE |
| `recurring_transactions` | template (daily/weekly/monthly/yearly) that generates transactions |
| `budgets` | monthly limit per expense category (`month` = first day of month) |

`transactions`, `recurring_transactions` and `budgets` reference categories through a composite FK
`(category_id, user_id, type)`, so a row can only use the same user's category of the matching type.
A category still used by transactions or recurring items cannot be deleted (409).

## Endpoints (`/api/v1`)

| Method | Path | Notes |
|---|---|---|
| POST | /auth/register | `{name, email, password, currency?}` → `{token, user}` |
| POST | /auth/login | `{email, password}` → `{token, user}` |
| GET/PUT | /me | profile (`{name, currency}`) |
| PUT | /me/password | `{current_password, new_password}` |
| GET/POST | /categories | `?type=income\|expense` |
| GET/PUT/DELETE | /categories/:id | |
| GET/POST | /transactions | `?type&category_id&from&to&q&page&limit`; response includes `totals` of the filter |
| GET/PUT/DELETE | /transactions/:id | |
| POST | /expenses | bulk expenses: `[{category_id, amount, note?, txn_date?}]`, max 100, all or nothing |
| GET/POST | /recurring | |
| GET/PUT/DELETE | /recurring/:id | delete keeps already generated transactions; resuming a paused item (`active` false→true) skips the occurrences missed while paused. `generated_count` = transactions it created |
| GET | /budgets | `?month=YYYY-MM` |
| PUT | /budgets | upsert `{category_id, month, amount}` |
| POST | /budgets/copy | `{from_month, to_month}` |
| DELETE | /budgets/:id | |
| GET | /reports/summary | `?from&to`; `previous` is the previous calendar month(s) for whole-month ranges, otherwise the same number of days before |
| GET | /reports/by-category | `?type=expense&from&to`; totals + percent |
| GET | /reports/trend | `?period=day\|month&from&to`; zero-filled |
| GET | /reports/budget | `?month=YYYY-MM`; budget vs spent per category |

All routes except `/auth/*` and `/health` need `Authorization: Bearer <token>`.
Dates are `YYYY-MM-DD`; `from`/`to` are inclusive and default to the current month (`APP_TIMEZONE`).

```json
POST /transactions
{ "type": "expense", "category_id": "...", "amount": 45000, "txn_date": "2026-10-05", "note": "lunch" }

POST /expenses   (txn_date defaults to today)
[ { "category_id": "...", "amount": 45000 }, { "category_id": "...", "amount": 20000 } ]

POST /recurring
{ "type": "income", "category_id": "...", "amount": 5000000, "frequency": "monthly",
  "start_date": "2026-10-25", "end_date": null, "note": "salary" }
```
