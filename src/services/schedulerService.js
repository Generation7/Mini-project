const cron = require('node-cron');
const reminderService = require('./reminderService');
const assignmentService = require('./assignmentService');
const examService = require('./examService');
const userService = require('./userService');
const weeklyDigestService = require('./weeklyDigestService');
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
      if (assignmentUser.remindersEnabled === false) continue;

      const dueTime = assignment.due_time || '23:59';
      const dueDateTime = new Date(`${assignment.dueDate}T${dueTime}:00`);

      const msUntilDue = dueDateTime - now;
      const hoursUntilDue = msUntilDue / (1000 * 60 * 60);

      if (hoursUntilDue > 47.9 && hoursUntilDue < 48.1) {
        bot.sendMessage(assignmentUser.telegram_chat_id,
          `❗❗❗ *Assignment Reminder!* ❗❗❗\n\n📚 *${assignment.courseCode}* - ${assignment.title}\n⏰ Due: *${assignment.dueDate} at ${dueTime}*\n\n⏳ 2 days to go — start planning!`,
          { parse_mode: 'Markdown' }
        );
        logger.info('Assignment 2-day reminder sent', { courseCode: assignment.courseCode });
      }

      if (hoursUntilDue > 23.9 && hoursUntilDue < 24.1) {
        bot.sendMessage(assignmentUser.telegram_chat_id,
          `❗❗❗ *Assignment Due Tomorrow!* ❗❗❗\n\n📚 *${assignment.courseCode}* - ${assignment.title}\n⏰ Due: *${assignment.dueDate} at ${dueTime}*\n\n📝 Make sure you're on track!`,
          { parse_mode: 'Markdown' }
        );
        logger.info('Assignment 1-day reminder sent', { courseCode: assignment.courseCode });
      }

      if (hoursUntilDue > 2.9 && hoursUntilDue < 3.1) {
        bot.sendMessage(assignmentUser.telegram_chat_id,
          `❗❗❗❗❗ *DUE IN 3 HOURS!* ❗❗❗❗❗\n\n📚 *${assignment.courseCode}* - ${assignment.title}\n⏰ Due: *${assignment.dueDate} at ${dueTime}*\n\n⚡ Final stretch — submit NOW!`,
          { parse_mode: 'Markdown' }
        );
        logger.info('Assignment 3-hour reminder sent', { courseCode: assignment.courseCode });
      }
    }
  } catch (err) {
    logger.error('Assignment reminder error', { error: err.message });
  }
}

function checkExamReminders() {
  try {
    if (!bot) return;

    const now = new Date();
    const upcomingExams = examService.getAllUpcomingExams();

    for (const exam of upcomingExams) {
      const examUser = userService.findById(exam.userId);
      if (!examUser?.telegram_chat_id) continue;
      if (examUser.remindersEnabled === false) continue;

      const examTime = exam.exam_time || exam.examTime || '08:00';
      const examDateTime = new Date(`${exam.examDate}T${examTime}:00`);

      const msUntilExam = examDateTime - now;
      const hoursUntilExam = msUntilExam / (1000 * 60 * 60);

      const venue = exam.venue ? `\n📍 Venue: *${exam.venue}*` : '';

      if (hoursUntilExam > 167.9 && hoursUntilExam < 168.1) {
        bot.sendMessage(examUser.telegram_chat_id,
          `❗❗❗ *Exam Coming Up!* ❗❗❗\n\n📚 *${exam.courseCode}* Exam\n📅 Date: *${exam.examDate}*\n⏰ Time: *${examTime}*${venue}\n\n⏳ 7 days to go — start studying!`,
          { parse_mode: 'Markdown' }
        );
        logger.info('Exam 7-day reminder sent', { courseCode: exam.courseCode });
      }

      if (hoursUntilExam > 71.9 && hoursUntilExam < 72.1) {
        bot.sendMessage(examUser.telegram_chat_id,
          `❗❗❗ *Exam in 3 Days!* ❗❗❗\n\n📚 *${exam.courseCode}* Exam\n📅 Date: *${exam.examDate}*\n⏰ Time: *${examTime}*${venue}\n\n📖 Step up your revision!`,
          { parse_mode: 'Markdown' }
        );
        logger.info('Exam 3-day reminder sent', { courseCode: exam.courseCode });
      }

      if (hoursUntilExam > 23.9 && hoursUntilExam < 24.1) {
        bot.sendMessage(examUser.telegram_chat_id,
          `❗❗❗ *Exam Tomorrow!* ❗❗❗\n\n📚 *${exam.courseCode}* Exam\n📅 Date: *${exam.examDate}*\n⏰ Time: *${examTime}*${venue}\n\n😤 Final revision tonight — you've got this!`,
          { parse_mode: 'Markdown' }
        );
        logger.info('Exam 1-day reminder sent', { courseCode: exam.courseCode });
      }

      if (hoursUntilExam > 2.9 && hoursUntilExam < 3.1) {
        bot.sendMessage(examUser.telegram_chat_id,
          `❗❗❗❗❗ *EXAM IN 3 HOURS!* ❗❗❗❗❗\n\n📚 *${exam.courseCode}* Exam\n📅 Date: *${exam.examDate}*\n⏰ Time: *${examTime}*${venue}\n\n🍀 Good luck — you've prepared for this!`,
          { parse_mode: 'Markdown' }
        );
        logger.info('Exam 3-hour reminder sent', { courseCode: exam.courseCode });
      }
    }
  } catch (err) {
    logger.error('Exam reminder error', { error: err.message });
  }
}
function sendWeeklyDigests() {
  try {
    if (!bot) return;

    const usersWithTelegram = userService.getAllUsersWithTelegram();

    for (const user of usersWithTelegram) {
      if (user.weeklyDigestEnabled === false) continue;

      const digest = weeklyDigestService.buildWeeklyDigest(user.id);
      if (!digest) continue;

      bot.sendMessage(user.telegramChatId, digest, { parse_mode: 'Markdown' })
        .catch(err => logger.error('Weekly digest send failed', { userId: user.id, error: err.message }));
    }

    logger.info('Weekly digest run completed', { userCount: usersWithTelegram.length });
  } catch (err) {
    logger.error('Weekly digest error', { error: err.message });
  }
}
function startScheduler(botInstance) {
  if (botInstance) bot = botInstance;

  // Check lecture reminders once daily at 8pm
  cron.schedule('0 20 * * *', () => {
    reminderService.createLectureReminderEvents();
    logger.info('Daily lecture reminder check completed');
  });

  // Weekly digest — every Sunday at 6pm
  cron.schedule('0 18 * * 0', () => {
    sendWeeklyDigests();
  });

  // Check assignment and exam reminders every 5 minutes
  cron.schedule('*/5 * * * *', () => {
    checkAssignmentReminders();
    checkExamReminders();
  });

  logger.info('Scheduler started');
}

module.exports = { startScheduler, setBotInstance };