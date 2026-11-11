-- Savings goals. Money put toward a goal is an ordinary expense (in the goal's category,
-- "ເງິນອອມ" by default) tagged with goal_id, so it lowers the period's balance like any expense.
CREATE TABLE goals (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name          TEXT          NOT NULL,
    target_amount NUMERIC(18,2) NOT NULL CHECK (target_amount > 0),
    category_id   UUID          NOT NULL,
    type          TEXT          NOT NULL DEFAULT 'expense' CHECK (type = 'expense'),
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    FOREIGN KEY (category_id, user_id, type) REFERENCES categories(id, user_id, type),
    UNIQUE (user_id, name)
);
CREATE INDEX idx_goals_user ON goals(user_id);

-- Deposits keep their history when a goal is deleted.
ALTER TABLE transactions ADD COLUMN goal_id UUID REFERENCES goals(id) ON DELETE SET NULL;
CREATE INDEX idx_tx_goal ON transactions(goal_id) WHERE goal_id IS NOT NULL;

-- A goal's automatic monthly deposit is a recurring item; it goes away with the goal.
ALTER TABLE recurring_transactions ADD COLUMN goal_id UUID REFERENCES goals(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX idx_recurring_goal ON recurring_transactions(goal_id) WHERE goal_id IS NOT NULL;

-- One-tap entries on the entry page: category + amount + optional note.
CREATE TABLE favorites (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type        TEXT          NOT NULL CHECK (type IN ('income', 'expense')),
    category_id UUID          NOT NULL,
    amount      NUMERIC(18,2) NOT NULL CHECK (amount > 0),
    note        TEXT,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    FOREIGN KEY (category_id, user_id, type) REFERENCES categories(id, user_id, type) ON DELETE CASCADE
);
CREATE INDEX idx_favorites_user ON favorites(user_id);
