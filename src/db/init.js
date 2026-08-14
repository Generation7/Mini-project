const { sqlite } = require('./client');

const requiredColumns = {
  users: ['id', 'name', 'email', 'password_hash', 'student_id', 'phone_number', 'telegram_chat_id', 'telegram_link_token', 'telegram_link_token_expires_at', 'calendar_token', 'weekly_digest_enabled', 'daily_summary_enabled', 'reminders_enabled', 'reminder_lead_minutes', 'created_at'],
  rules: ['id', 'user_id', 'trigger', 'condition', 'action', 'created_at'],
  events: ['id', 'type', 'data', 'created_at'],
  lectures: ['id', 'user_id', 'course_code', 'course_name', 'lecture_day', 'lecture_time', 'venue', 'reminder_sent', 'reminders_enabled'],
  reminders: ['id', 'lecture_id', 'event_id', 'reminder_date', 'created_at'],
  assignments: ['id', 'user_id', 'course_code', 'title', 'due_date', 'due_time', 'status', 'reminders_enabled', 'created_at'],
  exams: ['id', 'user_id', 'course_code', 'exam_date', 'exam_time', 'venue', 'status', 'reminders_enabled', 'created_at'],
  courses: ['id', 'user_id', 'course_code', 'course_name', 'credit_hours', 'score', 'academic_year', 'semester', 'created_at'],
  conversation_messages: ['id', 'user_id', 'role', 'content', 'created_at'],
  classes: ['id', 'name', 'join_code', 'creator_id', 'created_at'],
  class_members: ['id', 'class_id', 'user_id', 'joined_at'],
  class_items: ['id', 'class_id', 'type', 'payload', 'created_by', 'created_at'],
  class_item_acceptances: ['id', 'class_item_id', 'user_id', 'personal_record_id', 'accepted_at'],
};

function getTableColumns(tableName) {
  try {
    return sqlite.prepare(`PRAGMA table_info(${tableName})`).all().map(col => col.name);
  } catch (e) {
    return [];
  }
}

// Adds any columns from `columns` that don't already exist on `tableName`.
// Safe to call repeatedly - each column is only added if missing, and a
// failed ALTER for one column doesn't stop the others. Used for every
// table that needs to self-migrate an existing DB (as opposed to
// createFreshDatabase(), which only matters for brand-new DBs).
function addMissingColumns(tableName, columns) {
  const existing = getTableColumns(tableName);
  if (existing.length === 0) return;

  for (const col of columns) {
    if (!existing.includes(col.name)) {
      try {
        sqlite.exec(`ALTER TABLE ${tableName} ADD COLUMN ${col.name} ${col.ddl}`);
        console.log(`Added ${tableName}.${col.name} column.`);
      } catch (err) {
        console.log(`Skipped ${tableName}.${col.name}:`, err.message);
      }
    }
  }
}

function addMissingColumnsSafely() {
  const newUserColumns = [
    { name: 'name',             ddl: 'TEXT' },
    { name: 'email',            ddl: 'TEXT' },
    { name: 'password_hash',    ddl: 'TEXT' },
    { name: 'student_id',       ddl: 'TEXT' },
    { name: 'phone_number',     ddl: 'TEXT' },
    { name: 'telegram_chat_id', ddl: 'TEXT' },
    { name: 'telegram_link_token', ddl: 'TEXT' },
    { name: 'telegram_link_token_expires_at', ddl: 'TEXT' },
    { name: 'calendar_token',   ddl: 'TEXT' },
    { name: 'weekly_digest_enabled',  ddl: 'INTEGER NOT NULL DEFAULT 1' },
    { name: 'daily_summary_enabled',  ddl: 'INTEGER NOT NULL DEFAULT 1' },
    { name: 'reminders_enabled',      ddl: 'INTEGER NOT NULL DEFAULT 1' },
    { name: 'reminder_lead_minutes',  ddl: 'INTEGER NOT NULL DEFAULT 60' },
    { name: 'created_at',       ddl: "TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP" },
  ];

  addMissingColumns('users', newUserColumns);

  const remindersEnabledColumn = [
    { name: 'reminders_enabled', ddl: 'INTEGER NOT NULL DEFAULT 1' },
  ];
  addMissingColumns('lectures', remindersEnabledColumn);
  addMissingColumns('assignments', remindersEnabledColumn);
  addMissingColumns('exams', remindersEnabledColumn);

  // venue was added to the lectures Drizzle schema for photo-import support,
  // but this raw-SQL migration script was never updated to match - any
  // lectures table created before this fix is missing the column entirely,
  // which silently breaks every insert with "no such column: venue".
  addMissingColumns('lectures', [
    { name: 'venue', ddl: 'TEXT' },
  ]);

  const existing = getTableColumns('users');
  if (existing.length === 0) return;

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
    sqlite.exec(`CREATE UNIQUE INDEX IF NOT EXISTS users_telegram_link_token_unique ON users(telegram_link_token) WHERE telegram_link_token IS NOT NULL`);
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
      student_id TEXT,
      phone_number TEXT UNIQUE,
      telegram_chat_id TEXT UNIQUE,
      telegram_link_token TEXT UNIQUE,
      telegram_link_token_expires_at TEXT,
      calendar_token TEXT UNIQUE,
      weekly_digest_enabled INTEGER NOT NULL DEFAULT 1,
      daily_summary_enabled INTEGER NOT NULL DEFAULT 1,
      reminders_enabled INTEGER NOT NULL DEFAULT 1,
      reminder_lead_minutes INTEGER NOT NULL DEFAULT 60,
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
      venue TEXT,
      reminder_sent INTEGER NOT NULL DEFAULT 0,
      reminders_enabled INTEGER NOT NULL DEFAULT 1,
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
      reminders_enabled INTEGER NOT NULL DEFAULT 1,
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
      reminders_enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      course_code TEXT NOT NULL,
      course_name TEXT,
      credit_hours INTEGER NOT NULL,
      score TEXT NOT NULL,
      academic_year TEXT,
      semester TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS conversation_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      join_code TEXT NOT NULL UNIQUE,
      creator_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS class_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (class_id, user_id),
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS class_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_by INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS class_item_acceptances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_item_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      personal_record_id INTEGER,
      accepted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (class_item_id, user_id),
      FOREIGN KEY (class_item_id) REFERENCES class_items(id) ON DELETE CASCADE,
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