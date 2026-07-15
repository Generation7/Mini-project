const { sqlite } = require('./client');

const requiredColumns = {
  users: ['id', 'name', 'email', 'password_hash', 'phone_number', 'telegram_chat_id', 'created_at'],
  rules: ['id', 'user_id', 'trigger', 'condition', 'action', 'created_at'],
  events: ['id', 'type', 'data', 'created_at'],
  lectures: ['id', 'user_id', 'course_code', 'course_name', 'lecture_day', 'lecture_time', 'reminder_sent'],
  reminders: ['id', 'lecture_id', 'event_id', 'reminder_date', 'created_at'],
  assignments: ['id', 'user_id', 'course_code', 'title', 'due_date', 'due_time', 'status', 'created_at'],
  exams: ['id', 'user_id', 'course_code', 'exam_date', 'exam_time', 'venue', 'status', 'created_at'],
};

function getTableColumns(tableName) {
  try {
    return sqlite.prepare(`PRAGMA table_info(${tableName})`).all().map(col => col.name);
  } catch (e) {
    return [];
  }
}

function addMissingColumnsSafely() {
  const newUserColumns = [
    { name: 'name',             ddl: 'TEXT' },
    { name: 'email',            ddl: 'TEXT' },
    { name: 'password_hash',    ddl: 'TEXT' },
    { name: 'phone_number',     ddl: 'TEXT' },
    { name: 'telegram_chat_id', ddl: 'TEXT' },
    { name: 'created_at',       ddl: "TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP" },
  ];

  const existing = getTableColumns('users');
  if (existing.length === 0) return;

  for (const col of newUserColumns) {
    if (!existing.includes(col.name)) {
      try {
        sqlite.exec(`ALTER TABLE users ADD COLUMN ${col.name} ${col.ddl}`);
        console.log(`Added users.${col.name} column.`);
      } catch (err) {
        console.log(`Skipped users.${col.name}:`, err.message);
      }
    }
  }

  // If old DB had 'password' column but not 'password_hash', copy it over
  if (existing.includes('password') && !existing.includes('password_hash')) {
    try {
      sqlite.exec(`UPDATE users SET password_hash = password WHERE password_hash IS NULL`);
      console.log('Migrated password -> password_hash');
    } catch (err) {
      console.log('Could not migrate password column:', err.message);
    }
  }

  try {
    sqlite.exec(`CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users(email) WHERE email IS NOT NULL`);
    sqlite.exec(`CREATE UNIQUE INDEX IF NOT EXISTS users_telegram_unique ON users(telegram_chat_id) WHERE telegram_chat_id IS NOT NULL`);
  } catch (err) {
    console.log('Index note:', err.message);
  }
}

function hasSchemaMismatch() {
  for (const [tableName, columns] of Object.entries(requiredColumns)) {
    const existing = getTableColumns(tableName);
    if (existing.length === 0) return true;
    for (const col of columns) {
      if (!existing.includes(col)) return true;
    }
  }
  return false;
}

function createFreshDatabase() {
  sqlite.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT UNIQUE,
      password_hash TEXT,
      phone_number TEXT UNIQUE,
      telegram_chat_id TEXT UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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
}

sqlite.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
addMissingColumnsSafely();
createFreshDatabase();

if (hasSchemaMismatch()) {
  console.log('Schema still mismatched after migration — check your DB manually.');
}

console.log('Database initialized successfully.');