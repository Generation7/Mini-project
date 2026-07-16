const { eq, and } = require('drizzle-orm');
const { db } = require('../db/client');
const { courses } = require('../db/schema');
const { scoreToLetter, cwaToClassification } = require('../utils/knustGrading');

function addCourse({ userId, courseCode, courseName, creditHours, score, academicYear, semester }) {
  return db
    .insert(courses)
    .values({
      userId,
      courseCode,
      courseName: courseName || null,
      creditHours: Number(creditHours),
      score: String(score),
      academicYear: academicYear || null,
      semester: semester || null,
    })
    .returning()
    .get();
}

function getCoursesByUserId(userId) {
  return db.select().from(courses).where(eq(courses.userId, Number(userId))).all();
}

function updateCourse(userId, courseId, updates) {
  const existing = db.select().from(courses)
    .where(and(eq(courses.id, Number(courseId)), eq(courses.userId, Number(userId))))
    .get();
  if (!existing) return null;

  const patch = {};
  if (updates.courseCode !== undefined) patch.courseCode = updates.courseCode;
  if (updates.courseName !== undefined) patch.courseName = updates.courseName;
  if (updates.creditHours !== undefined) patch.creditHours = Number(updates.creditHours);
  if (updates.score !== undefined) patch.score = String(updates.score);
  if (updates.academicYear !== undefined) patch.academicYear = updates.academicYear;
  if (updates.semester !== undefined) patch.semester = updates.semester;

  db.update(courses).set(patch).where(eq(courses.id, existing.id)).run();
  return db.select().from(courses).where(eq(courses.id, existing.id)).get();
}

function deleteCourse(userId, courseId) {
  const existing = db.select().from(courses)
    .where(and(eq(courses.id, Number(courseId)), eq(courses.userId, Number(userId))))
    .get();
  if (!existing) return null;

  db.delete(courses).where(eq(courses.id, existing.id)).run();
  return existing;
}

// Computes the KNUST-style Cumulative Weighted Average:
// CWA = (sum of score * creditHours) / (sum of creditHours)
// Also breaks the result down per academic year / semester for a transcript view.
function calculateCwa(userId) {
  const userCourses = getCoursesByUserId(userId);

  const withGrades = userCourses.map(c => ({
    ...c,
    score: Number(c.score),
    letter: scoreToLetter(c.score),
    weightedMark: Number(c.score) * c.creditHours,
  }));

  const totalCredits = withGrades.reduce((sum, c) => sum + c.creditHours, 0);
  const totalWeightedMarks = withGrades.reduce((sum, c) => sum + c.weightedMark, 0);
  const cwa = totalCredits > 0 ? totalWeightedMarks / totalCredits : 0;

  // Group by academicYear + semester for a per-term breakdown
  const groups = {};
  withGrades.forEach(c => {
    const key = `${c.academicYear || 'Unspecified'} — Semester ${c.semester || '?'}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(c);
  });

  const breakdown = Object.entries(groups).map(([label, list]) => {
    const credits = list.reduce((sum, c) => sum + c.creditHours, 0);
    const weighted = list.reduce((sum, c) => sum + c.weightedMark, 0);
    const termCwa = credits > 0 ? weighted / credits : 0;
    return {
      label,
      courses: list,
      credits,
      cwa: Math.round(termCwa * 100) / 100,
    };
  });

  return {
    courses: withGrades,
    totalCredits,
    cwa: Math.round(cwa * 100) / 100,
    classification: cwaToClassification(cwa),
    breakdown,
  };
}

module.exports = {
  addCourse,
  getCoursesByUserId,
  updateCourse,
  deleteCourse,
  calculateCwa,
};