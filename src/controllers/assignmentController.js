const assignmentService = require('../services/assignmentService');

function createAssignment(req, res) {
  try {
    const { courseCode, title, dueDate, dueTime } = req.body;
    const assignment = assignmentService.createAssignment({ userId: req.userId, courseCode, title, dueDate, dueTime });
    return res.status(201).json({ success: true, assignment });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

function listAssignments(req, res) {
  try {
    const assignments = assignmentService.getAssignmentsByUserId(req.userId);
    return res.json({ success: true, assignments });
  } catch (err) {
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
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { createAssignment, listAssignments, completeAssignment, deleteAssignment };