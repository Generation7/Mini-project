const { and, eq } = require('drizzle-orm');
const { db } = require('../db/client');
const lectures = require('../models/lectureModel');

function findDuplicate({ userId, courseCode, lectureDay, lectureTime }) {
  return db
    .select()
    .from(lectures)
    .where(
      and(
        eq(lectures.userId, userId),
        eq(lectures.courseCode, courseCode),
        eq(lectures.lectureDay, lectureDay),
        eq(lectures.lectureTime, lectureTime)
      )
    )
    .get();
}

function createLecture({ userId, courseCode, courseName, lectureDay, lectureTime }) {
  const duplicate = findDuplicate({ userId, courseCode, lectureDay, lectureTime });

  if (duplicate) {
    return { lecture: duplicate, created: false };
  }

  const lecture = db
    .insert(lectures)
    .values({ userId, courseCode, courseName, lectureDay, lectureTime })
    .returning()
    .get();

  return { lecture, created: true };
}

function listLectures() {
  return db.select().from(lectures).all();
}

function getLectureById(id) {
  return db.select().from(lectures).where(eq(lectures.id, Number(id))).get();
}

function deleteLecture(id) {
  const lecture = getLectureById(id);
  if (!lecture) return null;

  db.delete(lectures).where(eq(lectures.id, Number(id))).run();
  return lecture;
}

function getLecturesByDay(lectureDay) {
  return db.select().from(lectures).where(eq(lectures.lectureDay, lectureDay)).all();
}

function getLecturesByUserId(userId) {
  return db.select().from(lectures).where(eq(lectures.userId, Number(userId))).all();
}

module.exports = {
  createLecture,
  findDuplicate,
  listLectures,
  getLectureById,
  deleteLecture,
  getLecturesByDay,
  getLecturesByUserId,
};