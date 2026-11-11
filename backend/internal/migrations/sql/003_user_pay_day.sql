-- Day of the month a pay period starts (salary day). Reports and budgets cover
-- pay_day .. pay_day-1 of the next month; 1 means calendar months.
ALTER TABLE users ADD COLUMN pay_day SMALLINT NOT NULL DEFAULT 25 CHECK (pay_day BETWEEN 1 AND 28);
