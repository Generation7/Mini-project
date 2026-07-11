require('./db/init');

const app = require('./app');
const env = require('./config/env');
const logger = require('./utils/logger');
const { startScheduler } = require('./services/schedulerService');
const { startWhatsAppWeb } = require('./services/whatsappWebService');
const { startTelegramBot } = require('./services/telegramService');

//startWhatsAppWeb();
startScheduler();
startTelegramBot();

const server = app.listen(env.port, () => {
  logger.info(`Server running on port ${env.port}`);
});

process.on('SIGTERM', () => { server.close(); });
process.on('SIGINT', () => { server.close(); process.exit(); });