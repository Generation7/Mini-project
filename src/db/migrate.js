require('dotenv').config();
const { db } = require('./client');

try {
  db.run(`ALTER TABLE assignments ADD COLUMN due_time TEXT NOT NULL DEFAULT '23:59'`);
  console.log('Added due_time column!');
} catch (err) {
  console.log('Column may already exist:', err.message);
}