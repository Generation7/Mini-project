const userService = require('./userService');
const { sendMessageWithRetry } = require('../utils/telegramRetry');

let telegramBot = null;

function setTelegramBot(bot) {
  telegramBot = bot;
}

// Lets other modules (e.g. the class-group dashboard controller) reuse the
// same bot instance for outgoing messages, instead of each needing their
// own wiring back to server.js.
function getTelegramBot() {
  return telegramBot;
}

async function sendRuleNotification(action) {
  const user = userService.findById(action.userId);
  if (!user) return { sent: false, reason: 'user_not_found' };

  if (telegramBot && user.telegramChatId) {
    try {
      await sendMessageWithRetry(telegramBot, user.telegramChatId, `Rule notification: ${action.action.type}`);
      return { sent: true };
    } catch (err) {
      console.error('Telegram rule notification error:', err.message);
      return { sent: false, reason: 'telegram_send_failed' };
    }
  }

  return { sent: false, reason: 'no_telegram_chat_id' };
}

async function sendLectureReminder(event) {
  const user = userService.findById(event.data.userId);
  const message = `❗ *Lecture Reminder!* ❗\n\n📚 *${event.data.courseCode}* is tomorrow at *${event.data.lectureTime}*\n\nDon't forget to attend!`;

  if (telegramBot && user?.telegramChatId) {
    try {
      await sendMessageWithRetry(telegramBot, user.telegramChatId, message, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('Telegram lecture reminder error:', err.message);
    }
  }
}

module.exports = { sendRuleNotification, sendLectureReminder, setTelegramBot, getTelegramBot };