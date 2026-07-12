require('dotenv').config();
const { db } = require('./client');

try {
  db.run(`ALTER TABLE assignments ADD COLUMN due_time TEXT NOT NULL DEFAULT '23:59'`);
  console.log('Added due_time column!');
} catch (err) {
  console.log('Column may already exist:', err.message);
}

try {
  db.run(`
    CREATE TABLE IF NOT EXISTS exams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      course_code TEXT NOT NULL,
      exam_date TEXT NOT NULL,
      exam_time TEXT NOT NULL DEFAULT '08:00',
      venue TEXT,
      status TEXT NOT NULL DEFAULT 'upcoming',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  console.log('Exams table created!');
} catch (err) {
  console.log('Error creating exams table:', err.message);
}