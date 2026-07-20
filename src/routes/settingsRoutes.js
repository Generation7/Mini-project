const express = require('express');
const settingsController = require('../controllers/settingsController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.patch('/profile', requireAuth, settingsController.updateProfile);
router.patch('/password', requireAuth, settingsController.updatePassword);
router.patch('/notifications', requireAuth, settingsController.updateNotifications);
router.delete('/account', requireAuth, settingsController.deleteAccount);

module.exports = router;