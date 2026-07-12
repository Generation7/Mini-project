const cron = require('node-cron');
const reminderService = require('./reminderService');
const { db } = require('../db/client');
const { assignments } = require('../db/schema');
const { eq } = require('drizzle-orm');
const userService = require('./userService');
const logger = require('../utils/logger');

let bot;

function setBotInstance(botInstance) {
  bot = botInstance;
}

function checkAssignmentReminders() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);

    const pendingAssignments = db.select().from(assignments)
      .where(eq(assignments.status, 'pending'))
      .all();

    for (const assignment of pendingAssignments) {
      if (assignment.dueDate === tomorrowStr) {
        if (bot) {
          bot.sendMessage(assignment.userId,
            `⚠️ *Assignment Reminder!*\n\n📚 *${assignment.courseCode}* - ${assignment.title}\n📅 Due: *Tomorrow (${assignment.dueDate})*\n\nDon't forget to submit!`,
            { parse_mode: 'Markdown' }
          );
          logger.info('Assignment reminder sent', { courseCode: assignment.courseCode });
        }
      }

      if (assignment.dueDate === today) {
        if (bot) {
          bot.sendMessage(assignment.userId,
            `🚨 *Due Today!*\n\n📚 *${assignment.courseCode}* - ${assignment.title}\n📅 Due: *Today (${assignment.dueDate})*\n\nMake sure to submit!`,
            { parse_mode: 'Markdown' }
          );
          logger.info('Assignment due today reminder sent', { courseCode: assignment.courseCode });
        }
      }
    }
  } catch (err) {
    logger.error('Assignment reminder error', { error: err.message });
  }
}

function startScheduler(botInstance) {
  if (botInstance) bot = botInstance;

  cron.schedule('* * * * *', () => {
    reminderService.createLectureReminderEvents();
    checkAssignmentReminders();
  });

  logger.info('Lecture reminder scheduler started');
}

module.exports = { startScheduler, setBotInstance };