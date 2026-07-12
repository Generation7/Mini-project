const { sqliteTable, integer, text } = require('drizzle-orm/sqlite-core');
const { sql } = require('drizzle-orm');

const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  phoneNumber: text('phone_number').notNull().unique(),
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

module.exports = { users, rules, events, lectures, reminders, assignments };