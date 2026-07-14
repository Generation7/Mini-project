const { sqlite } = require('./client');

const requiredColumns = {
  users: [
    'id',
    'name',
    'email',
    'password',
    'phone_number',
    'telegram_chat_id',
    'password_reset_token',
    'password_reset_expires'],
  rules: ['id', 'user_id', 'trigger', 'condition', 'action', 'created_at'],
  events: ['id', 'type', 'data', 'created_at'],
  lectures: [
    'id',
    'user_id',
    'course_code',
    'course_name',
    'lecture_day',
    'lecture_time',
    'reminder_sent',
  ],
  reminders: ['id', 'lecture_id', 'event_id', 'reminder_date', 'created_at'],
  assignments: [
    'id',
    'user_id',
    'course_code',
    'title',
    'due_date',
    'due_time',
    'status',
    'created_at',
  ],
  exams: [
    'id',
    'user_id',
    'course_code',
    'exam_date',
    'exam_time',
    'venue',
    'status',
    'created_at',
  ],
};

function getTableColumns(tableName) {
  return sqlite.prepare(`PRAGMA table_info(${tableName})`).all().map((column) => column.name);
}

function validateSchema() {
  const missingColumns = [];

  for (const [tableName, columns] of Object.entries(requiredColumns)) {
    const existingColumns = getTableColumns(tableName);

    for (const column of columns) {
      if (!existingColumns.includes(column)) {
        missingColumns.push(`${tableName}.${column}`);
      }
    }
  }

  if (missingColumns.length > 0) {
    throw new Error(`Database schema validation failed. Missing columns: ${missingColumns.join(', ')}`);
  }
}

sqlite.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    phone_number TEXT UNIQUE,
    telegram_chat_id TEXT,
    password_reset_token TEXT,
    password_reset_expires INTEGER
  );

  CREATE TABLE IF NOT EXISTS rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    trigger TEXT NOT NULL,
    condition TEXT NOT NULL,
    action TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS lectures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    course_code TEXT NOT NULL,
    course_name TEXT NOT NULL,
    lecture_day TEXT NOT NULL,
    lecture_time TEXT NOT NULL,
    reminder_sent INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lecture_id INTEGER NOT NULL,
    event_id INTEGER NOT NULL,
    reminder_date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (lecture_id, reminder_date),
    FOREIGN KEY (lecture_id) REFERENCES lectures(id) ON DELETE CASCADE,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    course_code TEXT NOT NULL,
    title TEXT NOT NULL,
    due_date TEXT NOT NULL,
    due_time TEXT NOT NULL DEFAULT '23:59',
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS exams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    course_code TEXT NOT NULL,
    exam_date TEXT NOT NULL,
    exam_time TEXT NOT NULL DEFAULT '08:00',
    venue TEXT,
    status TEXT NOT NULL DEFAULT 'upcoming',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

validateSchema();

console.log('Database initialized successfully.');
