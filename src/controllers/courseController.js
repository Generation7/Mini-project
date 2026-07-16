const courseService = require('../services/courseService');

function addCourse(req, res) {
  try {
    const { courseCode, courseName, creditHours, score, academicYear, semester } = req.body;

    if (!courseCode || creditHours === undefined || score === undefined) {
      return res.status(400).json({ success: false, message: 'courseCode, creditHours and score are required' });
    }
    const creditNum = Number(creditHours);
    const scoreNum = Number(score);
    if (!Number.isFinite(creditNum) || creditNum <= 0) {
      return res.status(400).json({ success: false, message: 'creditHours must be a positive number' });
    }
    if (!Number.isFinite(scoreNum) || scoreNum < 0 || scoreNum > 100) {
      return res.status(400).json({ success: false, message: 'score must be between 0 and 100' });
    }

    const course = courseService.addCourse({
      userId: req.userId,
      courseCode,
      courseName,
      creditHours: creditNum,
      score: scoreNum,
      academicYear,
      semester,
    });
    return res.status(201).json({ success: true, course });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

function listCourses(req, res) {
  try {
    const courses = courseService.getCoursesByUserId(req.userId);
    return res.json({ success: true, courses });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

function updateCourse(req, res) {
  try {
    const { id } = req.params;
    if (req.body.creditHours !== undefined) {
      const c = Number(req.body.creditHours);
      if (!Number.isFinite(c) || c <= 0) {
        return res.status(400).json({ success: false, message: 'creditHours must be a positive number' });
      }
    }
    if (req.body.score !== undefined) {
      const s = Number(req.body.score);
      if (!Number.isFinite(s) || s < 0 || s > 100) {
        return res.status(400).json({ success: false, message: 'score must be between 0 and 100' });
      }
    }

    const course = courseService.updateCourse(req.userId, id, req.body);
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
    return res.json({ success: true, course });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

function deleteCourse(req, res) {
  try {
    const { id } = req.params;
    const course = courseService.deleteCourse(req.userId, id);
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
    return res.json({ success: true, course });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

function getCwa(req, res) {
  try {
    const result = courseService.calculateCwa(req.userId);
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { addCourse, listCourses, updateCourse, deleteCourse, getCwa };