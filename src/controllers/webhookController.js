const env = require('../config/env');
const webhookService = require('../services/webhookService');

function verifyWebhook(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === env.whatsappVerifyToken) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
}

function receiveWebhook(req, res) {
  try {
    webhookService.handleIncomingWebhook(req.body);
    return res.sendStatus(200);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = { verifyWebhook, receiveWebhook };