const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcodeTerminal = require('qrcode-terminal');
const QRCode = require('qrcode');
const logger = require('../utils/logger');

let client;
let isReady = false;
let currentQRCode = null;

function formatChatId(phoneNumber) {
  const cleaned = String(phoneNumber || '').replace(/\D/g, '');
  return `${cleaned}@c.us`;
}

function startWhatsAppWeb() {
  if (client) {
    return client;
  }

  client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
    },
  });

  client.on('qr', async (qr) => {
    logger.info('WhatsApp QR code generated. Scan it with WhatsApp.');
    qrcodeTerminal.generate(qr, { small: true });

    try {
      currentQRCode = await QRCode.toDataURL(qr);
      logger.info('QR code available at http://localhost:' + (process.env.PORT || 3000) + '/whatsapp/qr');
    } catch (err) {
      logger.error('Failed to generate QR code data URL', { error: err.message });
    }
  });

  client.on('ready', () => {
    isReady = true;
    logger.info('WhatsApp connected');
  });

  client.on('authenticated', () => {
    logger.info('WhatsApp authenticated');
    isReady = true;
  });

  client.on('auth_failure', (message) => {
    isReady = false;
    logger.error('WhatsApp authentication failed', { message });
  });

  client.on('disconnected', (reason) => {
    isReady = false;
    logger.error('WhatsApp disconnected', { reason });
    logger.info('Attempting WhatsApp reconnect in 5 seconds...');
    setTimeout(() => {
      if (!isReady) {
        client.initialize();
      }
    }, 5000);
  });

  client.initialize();
  return client;
}

async function sendMessage(phoneNumber, message) {
  if (!phoneNumber) {
    logger.info('WhatsApp Web message skipped. Missing phone number.', { message });
    return { sent: false, skipped: true, reason: 'missing_phone_number' };
  }

  if (!isReady || !client) {
    logger.info('WhatsApp Web message skipped. Client not connected yet.', { phoneNumber, message });
    return { sent: false, skipped: true, reason: 'whatsapp_not_connected' };
  }

  const chatId = formatChatId(phoneNumber);
  const response = await client.sendMessage(chatId, message);

  logger.info('WhatsApp Web message sent', { phoneNumber });
  return { sent: true, id: response.id?._serialized };
}

function getQRCode() {
  return currentQRCode;
}

function getStatus() {
  return { isReady, hasQRCode: !!currentQRCode };
}

module.exports = { startWhatsAppWeb, sendMessage, getQRCode, getStatus };