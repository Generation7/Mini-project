const assignmentService = require('../services/assignmentService');
const logger = require('../utils/logger');

function createAssignment(req, res) {
  try {
    const { courseCode, courseName, title, dueDate, dueTime } = req.body;
    const result = assignmentService.createAssignment({ userId: req.userId, courseCode, courseName, title, dueDate, dueTime });

    if (!result.created) {
      return res.status(409).json({ success: false, message: 'Assignment already exists', assignment: result.assignment });
    }

    return res.status(201).json({ success: true, assignment: result.assignment });
  } catch (err) {
    logger.error('Failed to create assignment', { userId: req.userId, error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: err.message });
  }
}

function listAssignments(req, res) {
  try {
    const assignments = assignmentService.getAssignmentsByUserId(req.userId);
    return res.json({ success: true, assignments });
  } catch (err) {
    logger.error('Failed to list assignments', { userId: req.userId, error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: err.message });
  }
}

function completeAssignment(req, res) {
  try {
    const { courseCode } = req.body;
    const assignment = assignmentService.markAssignmentDone(req.userId, courseCode);
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });
    return res.json({ success: true, assignment });
  } catch (err) {
    logger.error('Failed to complete assignment', { userId: req.userId, error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: err.message });
  }
}

function deleteAssignment(req, res) {
  try {
    const { courseCode } = req.body;
    const assignment = assignmentService.deleteAssignment(req.userId, courseCode);
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });
    return res.json({ success: true, assignment });
  } catch (err) {
    logger.error('Failed to delete assignment', { userId: req.userId, error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: err.message });
  }
}

function toggleAssignmentReminder(req, res) {
  try {
    const { courseCode } = req.body;
    const assignment = assignmentService.toggleAssignmentReminder(req.userId, courseCode);
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });
    return res.json({ success: true, assignment });
  } catch (err) {
    logger.error('Failed to toggle assignment reminder', { userId: req.userId, error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { createAssignment, listAssignments, completeAssignment, deleteAssignment, toggleAssignmentReminder };