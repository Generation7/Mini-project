const express = require('express');
const examController = require('../controllers/examController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', requireAuth, examController.createExam);
router.get('/', requireAuth, examController.listExams);
router.put('/:id/complete', requireAuth, examController.completeExam);
router.delete('/:id', requireAuth, examController.deleteExam);

module.exports = router;