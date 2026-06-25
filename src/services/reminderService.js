const { and, eq } = require('drizzle-orm');
const { db } = require('../db/client');
const reminders = require('../models/reminderModel');
const lectureService = require('./lectureService');
const eventService = require('./eventService');
const actionService = require('./actionService');
const logger = require('../utils/logger');

function getTomorrowDayName() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  return tomorrow.toLocaleDateString('en-US', { weekday: 'long' });
}

function getReminderDate() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  return tomorrow.toISOString().slice(0, 10);
}

function reminderExists(lectureId, reminderDate) {
  return db
    .select()
    .from(reminders)
    .where(and(eq(reminders.lectureId, lectureId), eq(reminders.reminderDate, reminderDate)))
    .get();
}

function createLectureReminderEvents() {
  const lectureDay = getTomorrowDayName();
  const reminderDate = getReminderDate();
  const lectures = lectureService.getLecturesByDay(lectureDay);
  const created = [];

  for (const lecture of lectures) {
    if (reminderExists(lecture.id, reminderDate)) continue;

    const event = eventService.createEvent({
      type: 'lecture_reminder',
      data: {
        userId: lecture.userId,
        lectureId: lecture.id,
        courseCode: lecture.courseCode,
        courseName: lecture.courseName,
        lectureDay: lecture.lectureDay,
        lectureTime: lecture.lectureTime,
      },
    });

    db.insert(reminders)
      .values({ lectureId: lecture.id, eventId: event.id, reminderDate })
      .run();

    actionService.sendLectureReminder(event);

    created.push(event);
  }

  logger.info('Lecture reminder scheduler completed', {
    lectureDay,
    reminderDate,
    remindersCreated: created.length,
  });

  return created;
}

module.exports = { createLectureReminderEvents };