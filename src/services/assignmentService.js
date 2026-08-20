const { eq, and } = require('drizzle-orm');
const { db } = require('../db/client');
const { assignments } = require('../db/schema');

function findDuplicate({ userId, courseCode, title, dueDate }) {
  return db
    .select()
    .from(assignments)
    .where(
      and(
        eq(assignments.userId, userId),
        eq(assignments.courseCode, courseCode),
        eq(assignments.title, title),
        eq(assignments.dueDate, dueDate)
      )
    )
    .get();
}

function createAssignment({ userId, courseCode, courseName, title, dueDate, dueTime = '23:59' }) {
  const duplicate = findDuplicate({ userId, courseCode, title, dueDate });
  if (duplicate) {
    return { assignment: duplicate, created: false };
  }

  const assignment = db
    .insert(assignments)
    .values({ userId, courseCode, courseName: courseName || null, title, dueDate, dueTime, status: 'pending' })
    .returning()
    .get();

  return { assignment, created: true };
}

function getAssignmentsByUserId(userId) {
  return db.select().from(assignments).where(eq(assignments.userId, Number(userId))).all();
}

function getPendingAssignments(userId) {
  return db.select().from(assignments)
    .where(and(eq(assignments.userId, Number(userId)), eq(assignments.status, 'pending')))
    .all();
}

function markAssignmentDone(userId, courseCode) {
  // Find the most recent pending assignment for that course
  const assignment = db.select().from(assignments).where(
    and(
      eq(assignments.userId, Number(userId)),
      eq(assignments.courseCode, courseCode),
      eq(assignments.status, 'pending')
    )
  ).orderBy(assignments.id).get(); // or orderBy(desc(assignments.dueDate))

  if (!assignment) return null;

  return db.update(assignments)
    .set({ status: 'submitted' })
    .where(eq(assignments.id, assignment.id))
    .returning().get();
}

function deleteAssignment(userId, courseCode) {
  // This will delete the first matching assignment. Consider how to handle multiple.
  const assignment = db.select().from(assignments).where(and(eq(assignments.userId, Number(userId)), eq(assignments.courseCode, courseCode))).get();
  if (!assignment) return null;

  return db.delete(assignments).where(eq(assignments.id, assignment.id)).returning().get();
}

function toggleAssignmentReminder(userId, courseCode) {
  const assignment = db.select().from(assignments).where(
    and(eq(assignments.userId, Number(userId)), eq(assignments.courseCode, courseCode))
  ).get();
  if (!assignment) return null;

  return db.update(assignments)
    .set({ remindersEnabled: !assignment.remindersEnabled })
    .where(eq(assignments.id, assignment.id))
    .returning().get();
}

function getAllPendingAssignments() {
  return db.select().from(assignments)
    .where(eq(assignments.status, 'pending'))
    .all();
}

module.exports = {
  createAssignment,
  findDuplicate,
  getAssignmentsByUserId,
  getPendingAssignments,
  markAssignmentDone,
  deleteAssignment,
  getAllPendingAssignments,
  toggleAssignmentReminder,
};