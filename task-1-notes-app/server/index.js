const path = require('path');
const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve the frontend from ../client
app.use(express.static(path.join(__dirname, '..', 'client')));

function validate(body) {
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const content = typeof body.content === 'string' ? body.content : '';
  if (!title) return { error: 'Title is required.' };
  if (title.length > 120) return { error: 'Title must be 120 characters or fewer.' };
  return { title, content };
}

// GET /api/notes?q=search
app.get('/api/notes', (req, res) => {
  const q = (req.query.q || '').toString().trim();
  let rows;
  if (q) {
    const like = `%${q.replace(/[%_]/g, '\\$&')}%`;
    rows = db
      .prepare(
        `SELECT * FROM notes
         WHERE title LIKE ? ESCAPE '\\' OR content LIKE ? ESCAPE '\\'
         ORDER BY updated_at DESC, id DESC`
      )
      .all(like, like);
  } else {
    rows = db.prepare('SELECT * FROM notes ORDER BY updated_at DESC, id DESC').all();
  }
  res.json(rows);
});

// GET /api/notes/:id
app.get('/api/notes/:id', (req, res) => {
  const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id);
  if (!note) return res.status(404).json({ error: 'Note not found.' });
  res.json(note);
});

// POST /api/notes
app.post('/api/notes', (req, res) => {
  const v = validate(req.body || {});
  if (v.error) return res.status(400).json({ error: v.error });
  const info = db
    .prepare('INSERT INTO notes (title, content) VALUES (?, ?)')
    .run(v.title, v.content);
  const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(note);
});

// PUT /api/notes/:id
app.put('/api/notes/:id', (req, res) => {
  const v = validate(req.body || {});
  if (v.error) return res.status(400).json({ error: v.error });
  const info = db
    .prepare("UPDATE notes SET title = ?, content = ?, updated_at = datetime('now') WHERE id = ?")
    .run(v.title, v.content, req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Note not found.' });
  res.json(db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id));
});

// DELETE /api/notes/:id
app.delete('/api/notes/:id', (req, res) => {
  const info = db.prepare('DELETE FROM notes WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Note not found.' });
  res.status(204).end();
});

// Unknown API routes
app.use('/api', (req, res) => res.status(404).json({ error: 'Route not found.' }));

// Central error handler
app.use((err, req, res, next) => {
  console.error(err);
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON body.' });
  }
  res.status(500).json({ error: 'Internal server error.' });
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`Notes app running at http://localhost:${PORT}`));
}

module.exports = app;
