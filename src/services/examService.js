const { eq, and } = require('drizzle-orm');
const { db } = require('../db/client');
const { exams } = require('../db/schema');

function createExam({ userId, courseCode, examDate, examTime, venue }) {
  return db
    .insert(exams)
    .values({ userId, courseCode, examDate, examTime: examTime || '08:00', venue: venue || null, status: 'upcoming' })
    .returning()
    .get();
}

function getExamsByUserId(userId) {
  return db.select().from(exams).where(eq(exams.userId, Number(userId))).all();
}

function getUpcomingExams(userId) {
  return db.select().from(exams)
    .where(and(eq(exams.userId, Number(userId)), eq(exams.status, 'upcoming')))
    .all();
}

function getAllUpcomingExams() {
  return db.select().from(exams)
    .where(eq(exams.status, 'upcoming'))
    .all();
}

function markExamDone(userId, courseCode) {
  const userExams = getExamsByUserId(userId);
  const exam = userExams.find(e =>
    e.courseCode.replace(/\s/g, '').toLowerCase() === courseCode.replace(/\s/g, '').toLowerCase() &&
    e.status === 'upcoming'
  );
  if (!exam) return null;

  db.update(exams)
    .set({ status: 'completed' })
    .where(eq(exams.id, exam.id))
    .run();

  return exam;
}

function deleteExam(userId, courseCode) {
  const userExams = getExamsByUserId(userId);
  const exam = userExams.find(e =>
    e.courseCode.replace(/\s/g, '').toLowerCase() === courseCode.replace(/\s/g, '').toLowerCase()
  );
  if (!exam) return null;

  db.delete(exams).where(eq(exams.id, exam.id)).run();
  return exam;
}

module.exports = {
  createExam,
  getExamsByUserId,
  getUpcomingExams,
  getAllUpcomingExams,
  markExamDone,
  deleteExam,
};