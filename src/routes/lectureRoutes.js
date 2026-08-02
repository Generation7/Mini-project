const express = require('express');
const lectureController = require('../controllers/lectureController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', requireAuth, lectureController.createLecture);
router.get('/', requireAuth, lectureController.listLectures);
router.get('/:id', requireAuth, lectureController.getLecture);
router.put('/:id/toggle-reminder', requireAuth, lectureController.toggleLectureReminder);
router.delete('/:id', requireAuth, lectureController.deleteLecture);

module.exports = router;