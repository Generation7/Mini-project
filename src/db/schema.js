const { sqliteTable, integer, text } = require('drizzle-orm/sqlite-core');
const { sql } = require('drizzle-orm');

const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name'),
  email: text('email').unique(),
  passwordHash: text('password_hash'),
  studentId: text('student_id'),
  phoneNumber: text('phone_number').unique(),
  telegramChatId: text('telegram_chat_id').unique(),
  telegramLinkToken: text('telegram_link_token').unique(),
  telegramLinkTokenExpiresAt: text('telegram_link_token_expires_at'),
  calendarToken: text('calendar_token').unique(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

const rules = sqliteTable('rules', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  trigger: text('trigger').notNull(),
  condition: text('condition', { mode: 'json' }).notNull(),
  action: text('action', { mode: 'json' }).notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

const events = sqliteTable('events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  type: text('type').notNull(),
  data: text('data', { mode: 'json' }).notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

const lectures = sqliteTable('lectures', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  courseCode: text('course_code').notNull(),
  courseName: text('course_name').notNull(),
  lectureDay: text('lecture_day').notNull(),
  lectureTime: text('lecture_time').notNull(),
  reminderSent: integer('reminder_sent', { mode: 'boolean' }).notNull().default(false),
});

const reminders = sqliteTable('reminders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  lectureId: integer('lecture_id').notNull().references(() => lectures.id),
  eventId: integer('event_id').notNull().references(() => events.id),
  reminderDate: text('reminder_date').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

const assignments = sqliteTable('assignments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  courseCode: text('course_code').notNull(),
  title: text('title').notNull(),
  dueDate: text('due_date').notNull(),
  dueTime: text('due_time').notNull().default('23:59'),
  status: text('status').notNull().default('pending'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

const exams = sqliteTable('exams', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  courseCode: text('course_code').notNull(),
  examDate: text('exam_date').notNull(),
  examTime: text('exam_time').notNull().default('08:00'),
  venue: text('venue'),
  status: text('status').notNull().default('upcoming'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

const courses = sqliteTable('courses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  courseCode: text('course_code').notNull(),
  courseName: text('course_name'),
  creditHours: integer('credit_hours').notNull(),
  score: text('score').notNull(),
  academicYear: text('academic_year'),
  semester: text('semester'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Stores rolling Telegram chat history per user so the bot can hold context
// across messages (previously every message was sent to Groq in isolation).
// Pruned down to a fixed number of most-recent rows per user by
// conversationService, so this does not grow unbounded.
const conversationMessages = sqliteTable('conversation_messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  role: text('role').notNull(), // 'user' | 'assistant'
  content: text('content').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// A class/study group. Any student can create one and gets a short join
// code back to share with classmates. Only the creator can broadcast items
// to the group (see classItems below).
const classes = sqliteTable('classes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  joinCode: text('join_code').notNull().unique(),
  creatorId: integer('creator_id').notNull().references(() => users.id),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Membership join table. The creator is added as a member automatically
// when a class is created.
const classMembers = sqliteTable('class_members', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  classId: integer('class_id').notNull().references(() => classes.id),
  userId: integer('user_id').notNull().references(() => users.id),
  joinedAt: text('joined_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// An item (lecture/assignment/exam) the creator has broadcast to the class.
// Deliberately NOT written directly into a member's personal lectures/
// assignments/exams tables - each member has to explicitly accept it first
// (see classItemAcceptances). type-specific fields live in `payload` as JSON
// so this one table covers all three item kinds:
//   lecture:    { courseCode, lectureDay, lectureTime }
//   assignment: { courseCode, title, dueDate, dueTime }
//   exam:       { courseCode, examDate, examTime, venue }
const classItems = sqliteTable('class_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  classId: integer('class_id').notNull().references(() => classes.id),
  type: text('type').notNull(), // 'lecture' | 'assignment' | 'exam'
  payload: text('payload', { mode: 'json' }).notNull(),
  createdBy: integer('created_by').notNull().references(() => users.id),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Tracks which members have accepted which broadcast item into their own
// personal timetable/assignments/exams, and which personal row resulted -
// mainly so we never create duplicate personal records if the same accept
// is processed twice.
const classItemAcceptances = sqliteTable('class_item_acceptances', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  classItemId: integer('class_item_id').notNull().references(() => classItems.id),
  userId: integer('user_id').notNull().references(() => users.id),
  personalRecordId: integer('personal_record_id'),
  acceptedAt: text('accepted_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

module.exports = {
  users, rules, events, lectures, reminders, assignments, exams, courses, conversationMessages,
  classes, classMembers, classItems, classItemAcceptances,
};