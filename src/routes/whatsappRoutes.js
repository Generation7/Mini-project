const express = require('express');
const { getQRCodeEndpoint, getStatusEndpoint, getQRPageEndpoint, resetConnection, sendTestMessage } = require('../controllers/whatsappController');

const router = express.Router();

router.get('/qr', getQRPageEndpoint);
router.get('/qr-code', getQRCodeEndpoint);
router.get('/status', getStatusEndpoint);
router.post('/reset', resetConnection);
router.post('/test-message', sendTestMessage);

module.exports = router;
