const userService = require('../services/userService');

const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || 'AcadiaGenebot';

function createLinkToken(req, res) {
  try {
    const token = userService.createTelegramLinkToken(req.userId);
    const deepLink = `https://t.me/${BOT_USERNAME}?start=${token}`;
    return res.json({ success: true, deepLink });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

function getStatus(req, res) {
  try {
    const user = userService.findById(req.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    return res.json({ success: true, connected: !!user.telegramChatId });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

function unlink(req, res) {
  try {
    userService.unlinkTelegramChatId(req.userId);
    return res.json({ success: true, message: 'Telegram disconnected' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { createLinkToken, getStatus, unlink };