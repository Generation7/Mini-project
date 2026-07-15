const express = require('express');
const calendarController = require('../controllers/calendarController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/link', requireAuth, calendarController.getFeedLink);
router.get('/:token/feed.ics', calendarController.getFeed);

module.exports = router;