const { sqlite } = require('./client');

const requiredColumns = {
  users: ['id', 'phone_number', 'created_at'],
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
};

function getTableColumns(tableName) {
  return sqlite.prepare(`PRAGMA table_info(${tableName})`).all().map((column) => column.name);
}

function tableHasMismatch(tableName, columns) {
  const existingColumns = getTableColumns(tableName);

  if (existingColumns.length === 0) {
    return false;
  }

  return columns.some((column) => !existingColumns.includes(column));
}

function hasSchemaMismatch() {
  return Object.entries(requiredColumns).some(([tableName, columns]) => {
    return tableHasMismatch(tableName, columns);
  });
}

function resetDevelopmentDatabase() {
  console.warn('Schema mismatch detected. Resetting local development database.');

  sqlite.exec(`
    PRAGMA foreign_keys = OFF;
    DROP TABLE IF EXISTS reminders;
    DROP TABLE IF EXISTS lectures;
    DROP TABLE IF EXISTS rules;
    DROP TABLE IF EXISTS events;
    DROP TABLE IF EXISTS users;
    PRAGMA foreign_keys = ON;
  `);
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

if (hasSchemaMismatch()) {
  resetDevelopmentDatabase();
}

sqlite.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone_number TEXT NOT NULL UNIQUE,
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
`);

validateSchema();

console.log('Database initialized successfully.');
