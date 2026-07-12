const express = require('express');
const assignmentController = require('../controllers/assignmentController');

const router = express.Router();

router.post('/', assignmentController.createAssignment);
router.get('/', assignmentController.listAssignments);
router.put('/:id/complete', assignmentController.completeAssignment);
router.delete('/:id', assignmentController.deleteAssignment);

module.exports = router;