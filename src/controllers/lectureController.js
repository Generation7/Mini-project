const lectureService = require('../services/lectureService');
const { requireFields } = require('../utils/validators');
const logger = require('../utils/logger');

function createLecture(req, res) {
  try {
    const errors = requireFields(req.body, ['courseCode', 'courseName', 'lectureDay', 'lectureTime']);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    const result = lectureService.createLecture({ ...req.body, userId: req.userId });

    if (!result.created) {
      return res.status(409).json({ success: false, message: 'Lecture already exists', lecture: result.lecture });
    }

    return res.status(201).json({ success: true, lecture: result.lecture });
  } catch (err) {
    logger.error('Failed to create lecture', { userId: req.userId, error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: err.message });
  }
}

function listLectures(req, res) {
  try {
    return res.status(200).json({ success: true, lectures: lectureService.getLecturesByUserId(req.userId) });
  } catch (err) {
    logger.error('Failed to list lectures', { userId: req.userId, error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: err.message });
  }
}

function getLecture(req, res) {
  try {
    const lecture = lectureService.getLectureById(req.params.id);
    if (!lecture || lecture.userId !== req.userId) {
      return res.status(404).json({ success: false, message: 'Lecture not found' });
    }
    return res.status(200).json({ success: true, lecture });
  } catch (err) {
    logger.error('Failed to get lecture', { userId: req.userId, lectureId: req.params.id, error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: err.message });
  }
}

function deleteLecture(req, res) {
  try {
    const lecture = lectureService.getLectureById(req.params.id);
    if (!lecture || lecture.userId !== req.userId) {
      return res.status(404).json({ success: false, message: 'Lecture not found' });
    }
    lectureService.deleteLecture(req.params.id);
    return res.status(200).json({ success: true, message: 'Lecture deleted', lecture });
  } catch (err) {
    logger.error('Failed to delete lecture', { userId: req.userId, lectureId: req.params.id, error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: err.message });
  }
}

function toggleLectureReminder(req, res) {
  try {
    const lecture = lectureService.getLectureById(req.params.id);
    if (!lecture || lecture.userId !== req.userId) {
      return res.status(404).json({ success: false, message: 'Lecture not found' });
    }
    const updated = lectureService.toggleLectureReminder(req.params.id);
    return res.status(200).json({ success: true, lecture: updated });
  } catch (err) {
    logger.error('Failed to toggle lecture reminder', { userId: req.userId, lectureId: req.params.id, error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { createLecture, listLectures, getLecture, deleteLecture, toggleLectureReminder };