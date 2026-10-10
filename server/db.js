const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'notes.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Run schema on startup so setup is automatic
db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

module.exports = db;
