const express = require('express');
const courseController = require('../controllers/courseController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', requireAuth, courseController.addCourse);
router.get('/', requireAuth, courseController.listCourses);
router.get('/cwa', requireAuth, courseController.getCwa);
router.put('/:id', requireAuth, courseController.updateCourse);
router.delete('/:id', requireAuth, courseController.deleteCourse);

module.exports = router;