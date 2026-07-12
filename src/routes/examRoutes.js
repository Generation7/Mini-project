const express = require('express');
const examController = require('../controllers/examController');

const router = express.Router();

router.post('/', examController.createExam);
router.get('/', examController.listExams);
router.put('/:id/complete', examController.completeExam);
router.delete('/:id', examController.deleteExam);

module.exports = router;