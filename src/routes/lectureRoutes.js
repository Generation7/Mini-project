const express = require('express');
const lectureController = require('../controllers/lectureController');

const router = express.Router();

router.post('/', lectureController.createLecture);
router.get('/', lectureController.listLectures);
router.get('/:id', lectureController.getLecture);
router.delete('/:id', lectureController.deleteLecture);

module.exports = router;