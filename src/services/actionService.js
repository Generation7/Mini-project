const userService = require('./userService');
const whatsappService = require('./whatsappService');
const whatsappWebService = require('./whatsappWebService');
const env = require('../config/env');

let telegramBot = null;

function setTelegramBot(bot) {
  telegramBot = bot;
}

async function sendRuleNotification(action) {
  const user = userService.findById(action.userId);
  if (!user) return { sent: false, reason: 'user_not_found' };

  return whatsappService.sendMessage(user.phoneNumber, `Rule notification: ${action.action.type}`);
}

async function sendLectureReminder(event) {
  const user = userService.findById(event.data.userId);
  const phoneNumber = env.reminderPhone || user?.phoneNumber;
  const message = `❗ *Lecture Reminder!* ❗\n\n📚 *${event.data.courseCode}* is tomorrow at *${event.data.lectureTime}*\n\nDon't forget to attend!`;

  // Send via WhatsApp Web
  whatsappWebService.sendMessage(phoneNumber, `Reminder: ${event.data.courseCode} lecture is tomorrow at ${event.data.lectureTime}`);

  // Send via Telegram if user has a chat ID
  if (telegramBot && user?.telegram_chat_id) {
    try {
      await telegramBot.sendMessage(user.telegram_chat_id, message, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('Telegram lecture reminder error:', err.message);
    }
  }
}

module.exports = { sendRuleNotification, sendLectureReminder, setTelegramBot };