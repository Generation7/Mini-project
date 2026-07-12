const { eq, and } = require('drizzle-orm');
const { db } = require('../db/client');
const { assignments } = require('../db/schema');

function createAssignment({ userId, courseCode, title, dueDate, dueTime = '23:59' }) {
  return db
    .insert(assignments)
    .values({ userId, courseCode, title, dueDate, dueTime, status: 'pending' })
    .returning()
    .get();
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
  const userAssignments = getAssignmentsByUserId(userId);
  const assignment = userAssignments.find(a =>
    a.courseCode.replace(/\s/g, '').toLowerCase() === courseCode.replace(/\s/g, '').toLowerCase() &&
    a.status === 'pending'
  );
  if (!assignment) return null;

  db.update(assignments)
    .set({ status: 'submitted' })
    .where(eq(assignments.id, assignment.id))
    .run();

  return assignment;
}

function deleteAssignment(userId, courseCode) {
  const userAssignments = getAssignmentsByUserId(userId);
  const assignment = userAssignments.find(a =>
    a.courseCode.replace(/\s/g, '').toLowerCase() === courseCode.replace(/\s/g, '').toLowerCase()
  );
  if (!assignment) return null;

  db.delete(assignments).where(eq(assignments.id, assignment.id)).run();
  return assignment;
}

function getAllPendingAssignments() {
  return db.select().from(assignments)
    .where(eq(assignments.status, 'pending'))
    .all();
}

module.exports = {
  createAssignment,
  getAssignmentsByUserId,
  getPendingAssignments,
  markAssignmentDone,
  deleteAssignment,
  getAllPendingAssignments,
};