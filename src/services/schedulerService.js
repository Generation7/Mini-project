const cron = require('node-cron');
const reminderService = require('./reminderService');
const assignmentService = require('./assignmentService');
const userService = require('./userService');
const logger = require('../utils/logger');

let bot;

function setBotInstance(botInstance) {
  bot = botInstance;
}

function checkAssignmentReminders() {
  try {
    if (!bot) return;

    const now = new Date();
    const pendingAssignments = assignmentService.getAllPendingAssignments();

    for (const assignment of pendingAssignments) {
      const assignmentUser = userService.findById(assignment.userId);
      if (!assignmentUser?.telegram_chat_id) continue;

      const dueTime = assignment.due_time || '23:59';
      const dueDateTime = new Date(`${assignment.dueDate}T${dueTime}:00`);

      const msUntilDue = dueDateTime - now;
      const hoursUntilDue = msUntilDue / (1000 * 60 * 60);

      // 2 days before (between 47.9 and 48.1 hours)
      if (hoursUntilDue > 47.9 && hoursUntilDue < 48.1) {
        bot.sendMessage(assignmentUser.telegram_chat_id,
          `📅 *Assignment Reminder!*\n\n📚 *${assignment.courseCode}* - ${assignment.title}\n⏰ Due: *${assignment.dueDate} at ${dueTime}*\n\n⏳ 2 days to go — start planning!`,
          { parse_mode: 'Markdown' }
        );
        logger.info('Assignment 2-day reminder sent', { courseCode: assignment.courseCode });
      }

      // 1 day before (between 23.9 and 24.1 hours)
      if (hoursUntilDue > 23.9 && hoursUntilDue < 24.1) {
        bot.sendMessage(assignmentUser.telegram_chat_id,
          `⚠️ *Assignment Due Tomorrow!*\n\n📚 *${assignment.courseCode}* - ${assignment.title}\n⏰ Due: *${assignment.dueDate} at ${dueTime}*\n\n📝 Make sure you're on track!`,
          { parse_mode: 'Markdown' }
        );
        logger.info('Assignment 1-day reminder sent', { courseCode: assignment.courseCode });
      }

      // 3 hours before (between 2.9 and 3.1 hours)
      if (hoursUntilDue > 2.9 && hoursUntilDue < 3.1) {
        bot.sendMessage(assignmentUser.telegram_chat_id,
          `🚨 *Due in 3 Hours!*\n\n📚 *${assignment.courseCode}* - ${assignment.title}\n⏰ Due: *${assignment.dueDate} at ${dueTime}*\n\n⚡ Final stretch — submit now!`,
          { parse_mode: 'Markdown' }
        );
        logger.info('Assignment 3-hour reminder sent', { courseCode: assignment.courseCode });
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