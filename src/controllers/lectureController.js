const lectureService = require('../services/lectureService');
const { requireFields } = require('../utils/validators');

function createLecture(req, res) {
  const errors = requireFields(req.body, [
    'userId',
    'courseCode',
    'courseName',
    'lectureDay',
    'lectureTime',
  ]);

  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  const result = lectureService.createLecture(req.body);

  if (!result.created) {
    return res.status(409).json({
      success: false,
      message: 'Lecture already exists',
      lecture: result.lecture,
    });
  }

  return res.status(201).json({ success: true, lecture: result.lecture });
}

function listLectures(req, res) {
  return res.status(200).json({ success: true, lectures: lectureService.listLectures() });
}

function getLecture(req, res) {
  const lecture = lectureService.getLectureById(req.params.id);

  if (!lecture) {
    return res.status(404).json({ success: false, message: 'Lecture not found' });
  }

  return res.status(200).json({ success: true, lecture });
}

function deleteLecture(req, res) {
  const lecture = lectureService.deleteLecture(req.params.id);

  if (!lecture) {
    return res.status(404).json({ success: false, message: 'Lecture not found' });
  }

  return res.status(200).json({ success: true, message: 'Lecture deleted', lecture });
}

module.exports = { createLecture, listLectures, getLecture, deleteLecture };