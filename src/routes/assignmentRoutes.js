const express = require('express');
const assignmentController = require('../controllers/assignmentController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', requireAuth, assignmentController.createAssignment);
router.get('/', requireAuth, assignmentController.listAssignments);
router.put('/:id/complete', requireAuth, assignmentController.completeAssignment);
router.delete('/:id', requireAuth, assignmentController.deleteAssignment);

module.exports = router;