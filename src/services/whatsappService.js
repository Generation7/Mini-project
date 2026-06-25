const axios = require('axios');
const env = require('../config/env');
const logger = require('../utils/logger');

async function sendMessage(phoneNumber, message) {
  if (!env.whatsappAccessToken || !env.whatsappPhoneNumberId) {
    logger.info('WhatsApp message skipped. Missing Cloud API credentials.', {
      phoneNumber,
      message,
    });

    return { sent: false, skipped: true, reason: 'missing_credentials' };
  }

  const url = `https://graph.facebook.com/${env.whatsappApiVersion}/${env.whatsappPhoneNumberId}/messages`;

  const response = await axios.post(
    url,
    {
      messaging_product: 'whatsapp',
      to: phoneNumber,
      type: 'text',
      text: {
        body: message,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${env.whatsappAccessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  logger.info('WhatsApp message sent', { phoneNumber });

  return { sent: true, data: response.data };
}

module.exports = { sendMessage };