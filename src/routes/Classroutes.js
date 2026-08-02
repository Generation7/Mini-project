const express = require('express');
const classController = require('../controllers/classController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', requireAuth, classController.listMyClasses);
router.post('/', requireAuth, classController.createClass);
router.post('/join', requireAuth, classController.joinClass);

// Static path registered before the :classId param routes so it isn't
// swallowed as a classId value.
router.get('/updates', requireAuth, classController.getPendingUpdates);
router.post('/updates/:itemId/accept', requireAuth, classController.acceptUpdate);

router.get('/:classId/members', requireAuth, classController.getClassMembers);
router.post('/:classId/broadcast', requireAuth, classController.broadcastItem);

module.exports = router;