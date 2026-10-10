-- Expense Tracker schema (SQLite)
-- Amounts are stored as integer cents so totals never suffer floating-point drift.
CREATE TABLE IF NOT EXISTS transactions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  type         TEXT    NOT NULL CHECK (type IN ('income', 'expense')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  category     TEXT    NOT NULL,
  description  TEXT    NOT NULL DEFAULT '' CHECK (length(description) <= 200),
  date         TEXT    NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions (date DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions (type);
