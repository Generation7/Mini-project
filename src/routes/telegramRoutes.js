const express = require('express');
const telegramController = require('../controllers/telegramController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/link-token', requireAuth, telegramController.createLinkToken);
router.get('/status', requireAuth, telegramController.getStatus);
router.delete('/link', requireAuth, telegramController.unlink);

module.exports = router;