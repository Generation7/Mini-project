const examService = require('../services/examService');

function createExam(req, res) {
  try {
    const { userId, courseCode, examDate, examTime, venue } = req.body;
    const exam = examService.createExam({ userId, courseCode, examDate, examTime, venue });
    return res.status(201).json({ success: true, exam });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

function listExams(req, res) {
  try {
    const { userId } = req.query;
    const exams = userId
      ? examService.getUpcomingExams(userId)
      : examService.getAllUpcomingExams();
    return res.json({ success: true, exams });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

function completeExam(req, res) {
  try {
    const { userId, courseCode } = req.body;
    const exam = examService.markExamDone(userId, courseCode);
    if (!exam) return res.status(404).json({ success: false, message: 'Exam not found' });
    return res.json({ success: true, exam });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

function deleteExam(req, res) {
  try {
    const { userId, courseCode } = req.body;
    const exam = examService.deleteExam(userId, courseCode);
    if (!exam) return res.status(404).json({ success: false, message: 'Exam not found' });
    return res.json({ success: true, exam });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { createExam, listExams, completeExam, deleteExam };