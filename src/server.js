require('./db/init');

const app = require('./app');
const env = require('./config/env');
const logger = require('./utils/logger');
const { startScheduler, setBotInstance } = require('./services/schedulerService');
const { startWhatsAppWeb } = require('./services/whatsappWebService');
const { startTelegramBot } = require('./services/telegramService');
const { setTelegramBot } = require('./services/actionService');

//startWhatsAppWeb();
startScheduler();
const bot = startTelegramBot();
if (bot) {
  setBotInstance(bot);
  setTelegramBot(bot);
}

const server = app.listen(env.port, () => {
  logger.info(`Server running on port ${env.port}`);
});

process.on('SIGTERM', () => { server.close(); });
process.on('SIGINT', () => { server.close(); process.exit(); });