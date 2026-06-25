const userService = require('./userService');
const whatsappService = require('./whatsappService');
const whatsappWebService = require('./whatsappWebService');
const env = require('../config/env');

async function sendRuleNotification(action) {
  const user = userService.findById(action.userId);
  if (!user) return { sent: false, reason: 'user_not_found' };

  return whatsappService.sendMessage(user.phoneNumber, `Rule notification: ${action.action.type}`);
}

async function sendLectureReminder(event) {
  const fallbackUser = userService.findById(event.data.userId);
  const phoneNumber = env.reminderPhone || fallbackUser?.phoneNumber;
  const message = `Reminder: ${event.data.courseCode} lecture is tomorrow at ${event.data.lectureTime}`;

  return whatsappWebService.sendMessage(phoneNumber, message);
}

module.exports = { sendRuleNotification, sendLectureReminder };