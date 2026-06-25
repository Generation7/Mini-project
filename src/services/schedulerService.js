const cron = require('node-cron');
const reminderService = require('./reminderService');
const logger = require('../utils/logger');

function startScheduler() {
  cron.schedule('* * * * *', () => {
    reminderService.createLectureReminderEvents();
  });

  logger.info('Lecture reminder scheduler started');
}

module.exports = { startScheduler };