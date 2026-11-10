CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          TEXT        NOT NULL,
    email         TEXT        NOT NULL UNIQUE,
    password_hash TEXT        NOT NULL,
    currency      TEXT        NOT NULL DEFAULT 'LAK',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE categories (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       TEXT        NOT NULL,
    type       TEXT        NOT NULL CHECK (type IN ('income', 'expense')),
    color      TEXT,
    icon       TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, type, name),
    UNIQUE (id, user_id, type) -- target for the composite FKs below
);

-- Template for income/expense that repeats; the server materializes due occurrences into transactions.
CREATE TABLE recurring_transactions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type          TEXT          NOT NULL CHECK (type IN ('income', 'expense')),
    category_id   UUID          NOT NULL,
    amount        NUMERIC(18,2) NOT NULL CHECK (amount > 0),
    note          TEXT,
    frequency     TEXT          NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
    start_date    DATE          NOT NULL,
    end_date      DATE CHECK (end_date IS NULL OR end_date >= start_date),
    run_count     INT           NOT NULL DEFAULT 0, -- occurrences generated so far
    next_run_date DATE          NOT NULL,
    active        BOOLEAN       NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    FOREIGN KEY (category_id, user_id, type) REFERENCES categories(id, user_id, type)
);
CREATE INDEX idx_recurring_due ON recurring_transactions(next_run_date) WHERE active;
CREATE INDEX idx_recurring_user ON recurring_transactions(user_id);

-- The composite FK guarantees the category belongs to the same user and has the same type.
-- A category that is still in use cannot be deleted (NO ACTION is checked at statement end, so user CASCADE still works).
CREATE TABLE transactions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type         TEXT          NOT NULL CHECK (type IN ('income', 'expense')),
    category_id  UUID          NOT NULL,
    amount       NUMERIC(18,2) NOT NULL CHECK (amount > 0),
    txn_date     DATE          NOT NULL,
    note         TEXT,
    recurring_id UUID          REFERENCES recurring_transactions(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
    FOREIGN KEY (category_id, user_id, type) REFERENCES categories(id, user_id, type),
    UNIQUE (recurring_id, txn_date) -- one generated occurrence per date
);
CREATE INDEX idx_tx_user_date ON transactions(user_id, txn_date DESC);
CREATE INDEX idx_tx_user_type_date ON transactions(user_id, type, txn_date);
CREATE INDEX idx_tx_category ON transactions(category_id);

-- Monthly spending limit per expense category; month is always the first day of the month.
CREATE TABLE budgets (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id UUID          NOT NULL,
    type        TEXT          NOT NULL DEFAULT 'expense' CHECK (type = 'expense'),
    month       DATE          NOT NULL CHECK (EXTRACT(DAY FROM month) = 1),
    amount      NUMERIC(18,2) NOT NULL CHECK (amount > 0),
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    FOREIGN KEY (category_id, user_id, type) REFERENCES categories(id, user_id, type) ON DELETE CASCADE,
    UNIQUE (user_id, category_id, month)
);
CREATE INDEX idx_budgets_user_month ON budgets(user_id, month);
