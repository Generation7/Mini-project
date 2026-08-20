const { eq, and } = require('drizzle-orm');
const { db } = require('../db/client');
const { exams } = require('../db/schema');

function findDuplicate({ userId, courseCode, examDate }) {
  return db
    .select()
    .from(exams)
    .where(
      and(
        eq(exams.userId, userId),
        eq(exams.courseCode, courseCode),
        eq(exams.examDate, examDate)
      )
    )
    .get();
}

function createExam({ userId, courseCode, courseName, examDate, examTime, venue }) {
  const duplicate = findDuplicate({ userId, courseCode, examDate });
  if (duplicate) {
    return { exam: duplicate, created: false };
  }

  const exam = db
    .insert(exams)
    .values({ userId, courseCode, courseName: courseName || null, examDate, examTime: examTime || '08:00', venue: venue || null, status: 'upcoming' })
    .returning()
    .get();

  return { exam, created: true };
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

function toggleExamReminder(userId, courseCode) {
  const userExams = getExamsByUserId(userId);
  const exam = userExams.find(e =>
    e.courseCode.replace(/\s/g, '').toLowerCase() === courseCode.replace(/\s/g, '').toLowerCase()
  );
  if (!exam) return null;

  db.update(exams)
    .set({ remindersEnabled: !exam.remindersEnabled })
    .where(eq(exams.id, exam.id))
    .run();

  return { ...exam, remindersEnabled: !exam.remindersEnabled };
}

module.exports = {
  createExam,
  findDuplicate,
  getExamsByUserId,
  getUpcomingExams,
  getAllUpcomingExams,
  markExamDone,
  deleteExam,
  toggleExamReminder,
};