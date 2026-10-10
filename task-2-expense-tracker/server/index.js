const path = require('path');
const express = require('express');
const cors = require('cors');
const db = require('./db');
const CATEGORIES = require('./categories');
const { validateTransaction } = require('./validate');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Serve the frontend from ../client so one command starts the whole app.
app.use(express.static(path.join(__dirname, '..', 'client')));

const toApi = (r) => ({
  id: r.id,
  type: r.type,
  amount: r.amount_cents / 100,
  amount_cents: r.amount_cents,
  category: r.category,
  description: r.description,
  date: r.date,
  created_at: r.created_at,
});

// GET /api/categories
app.get('/api/categories', (req, res) => res.json(CATEGORIES));

// GET /api/transactions?type=income|expense
app.get('/api/transactions', (req, res) => {
  const { type } = req.query;
  if (type !== undefined && type !== 'income' && type !== 'expense') {
    return res.status(400).json({ error: 'type must be "income" or "expense".' });
  }
  const rows = type
    ? db.prepare('SELECT * FROM transactions WHERE type = ? ORDER BY date DESC, id DESC').all(type)
    : db.prepare('SELECT * FROM transactions ORDER BY date DESC, id DESC').all();
  res.json(rows.map(toApi));
});

// GET /api/summary  - totals are computed by the database, always over ALL transactions
app.get('/api/summary', (req, res) => {
  const row = db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN type = 'income'  THEN amount_cents END), 0) AS income_cents,
         COALESCE(SUM(CASE WHEN type = 'expense' THEN amount_cents END), 0) AS expense_cents,
         COUNT(*) AS count
       FROM transactions`
    )
    .get();
  res.json({
    income_cents: row.income_cents,
    expense_cents: row.expense_cents,
    net_cents: row.income_cents - row.expense_cents,
    count: row.count,
  });
});

// POST /api/transactions
app.post('/api/transactions', (req, res) => {
  const { errors, value } = validateTransaction(req.body);
  if (errors) return res.status(400).json({ error: 'Validation failed.', errors });
  const info = db
    .prepare(
      'INSERT INTO transactions (type, amount_cents, category, description, date) VALUES (?, ?, ?, ?, ?)'
    )
    .run(value.type, value.amount_cents, value.category, value.description, value.date);
  const row = db.prepare('SELECT * FROM transactions WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(toApi(row));
});

// DELETE /api/transactions/:id
app.delete('/api/transactions/:id', (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: 'Invalid id.' });
  const info = db.prepare('DELETE FROM transactions WHERE id = ?').run(Number(req.params.id));
  if (info.changes === 0) return res.status(404).json({ error: 'Transaction not found.' });
  res.status(204).end();
});

// Unknown API routes
app.use('/api', (req, res) => res.status(404).json({ error: 'Route not found.' }));

// Central error handler
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON body.' });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error.' });
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`Expense tracker running at http://localhost:${PORT}`));
}

module.exports = app;
