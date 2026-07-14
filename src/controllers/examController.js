const examService = require('../services/examService');

function createExam(req, res) {
  try {
    const { courseCode, examDate, examTime, venue } = req.body;
    const exam = examService.createExam({ userId: req.userId, courseCode, examDate, examTime, venue });
    return res.status(201).json({ success: true, exam });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

function listExams(req, res) {
  try {
    const exams = examService.getUpcomingExams(req.userId);
    return res.json({ success: true, exams });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

function completeExam(req, res) {
  try {
    const { courseCode } = req.body;
    const exam = examService.markExamDone(req.userId, courseCode);
    if (!exam) return res.status(404).json({ success: false, message: 'Exam not found' });
    return res.json({ success: true, exam });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

function deleteExam(req, res) {
  try {
    const { courseCode } = req.body;
    const exam = examService.deleteExam(req.userId, courseCode);
    if (!exam) return res.status(404).json({ success: false, message: 'Exam not found' });
    return res.json({ success: true, exam });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { createExam, listExams, completeExam, deleteExam };