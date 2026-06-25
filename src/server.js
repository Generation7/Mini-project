require('./db/init');

const app = require('./app');
const env = require('./config/env');
const logger = require('./utils/logger');
const { startScheduler } = require('./services/schedulerService');
const { startWhatsAppWeb } = require('./services/whatsappWebService');

startWhatsAppWeb();
startScheduler();

app.listen(env.port, () => {
  logger.info(`Server running on port ${env.port}`);
});
