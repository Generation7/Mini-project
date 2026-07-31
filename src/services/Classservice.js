const { eq, and, inArray } = require('drizzle-orm');
const { db } = require('../db/client');
const classes = require('../models/classModel');
const classMembers = require('../models/classMemberModel');
const classItems = require('../models/classItemModel');
const classItemAcceptances = require('../models/classItemAcceptanceModel');
const users = require('../models/userModel');

// Excludes visually ambiguous characters (0/O, 1/I) so codes are easy to
// read aloud or copy from a phone screen.
const JOIN_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const JOIN_CODE_LENGTH = 6;

function generateJoinCode() {
  let code = '';
  for (let i = 0; i < JOIN_CODE_LENGTH; i++) {
    code += JOIN_CODE_CHARS[Math.floor(Math.random() * JOIN_CODE_CHARS.length)];
  }
  return code;
}

function getClassByJoinCode(joinCode) {
  if (!joinCode) return undefined;
  return db.select().from(classes).where(eq(classes.joinCode, joinCode.toUpperCase().trim())).get();
}

function getClassById(classId) {
  return db.select().from(classes).where(eq(classes.id, Number(classId))).get();
}

function createClass(creatorId, name) {
  // Vanishingly unlikely to collide at 33^6 possibilities, but check anyway
  // rather than trust it blindly.
  let joinCode = generateJoinCode();
  while (getClassByJoinCode(joinCode)) {
    joinCode = generateJoinCode();
  }

  const created = db
    .insert(classes)
    .values({ name, joinCode, creatorId: Number(creatorId) })
    .returning()
    .get();

  db.insert(classMembers).values({ classId: created.id, userId: Number(creatorId) }).run();

  return created;
}

function isClassMember(classId, userId) {
  return !!db
    .select()
    .from(classMembers)
    .where(and(eq(classMembers.classId, Number(classId)), eq(classMembers.userId, Number(userId))))
    .get();
}

// Returns { error: 'not_found' | 'already_member' } or { class, joined: true }
function joinClassByCode(userId, joinCode) {
  const klass = getClassByJoinCode(joinCode);
  if (!klass) return { error: 'not_found' };

  if (isClassMember(klass.id, userId)) {
    return { error: 'already_member', class: klass };
  }

  db.insert(classMembers).values({ classId: klass.id, userId: Number(userId) }).run();
  return { class: klass, joined: true };
}

// Returns the classes a user belongs to, each tagged with whether they're
// the creator (creators get broadcast rights).
function getUserClasses(userId) {
  const rows = db
    .select({ classRow: classes })
    .from(classMembers)
    .innerJoin(classes, eq(classMembers.classId, classes.id))
    .where(eq(classMembers.userId, Number(userId)))
    .all();

  return rows.map(r => ({ ...r.classRow, isCreator: r.classRow.creatorId === Number(userId) }));
}

// Case-insensitive match against classes the user themselves created -
// used to resolve "broadcast to <name>" when a creator belongs to more
// than one class. Returns undefined if no unambiguous match.
function findOwnedClassByName(userId, name) {
  if (!name) return undefined;
  const owned = db.select().from(classes).where(eq(classes.creatorId, Number(userId))).all();
  const needle = name.trim().toLowerCase();
  return owned.find(c => c.name.trim().toLowerCase() === needle);
}

function isClassCreator(classId, userId) {
  const klass = getClassById(classId);
  return !!klass && klass.creatorId === Number(userId);
}

// Members other than the given user who have a linked Telegram account -
// i.e. who to actually notify on a broadcast.
function getNotifiableMembers(classId, excludeUserId) {
  const rows = db
    .select({ userId: users.id, telegramChatId: users.telegramChatId, name: users.name })
    .from(classMembers)
    .innerJoin(users, eq(classMembers.userId, users.id))
    .where(eq(classMembers.classId, Number(classId)))
    .all();

  return rows.filter(r => r.userId !== Number(excludeUserId) && !!r.telegramChatId);
}

// Only the creator may broadcast. Returns the created item, or null if the
// caller isn't the creator (caller is expected to check isClassCreator
// first for a friendlier error message - this is a hard backstop).
function broadcastItem({ classId, creatorId, type, payload }) {
  if (!isClassCreator(classId, creatorId)) return null;

  return db
    .insert(classItems)
    .values({ classId: Number(classId), type, payload, createdBy: Number(creatorId) })
    .returning()
    .get();
}

function getClassItemById(itemId) {
  return db.select().from(classItems).where(eq(classItems.id, Number(itemId))).get();
}

// Items broadcast to any of the user's classes that they have not yet
// accepted, most recent first.
function getPendingItemsForUser(userId, limit = 10) {
  const myClasses = getUserClasses(userId);
  if (!myClasses.length) return [];
  const classIds = myClasses.map(c => c.id);

  const accepted = db
    .select({ classItemId: classItemAcceptances.classItemId })
    .from(classItemAcceptances)
    .where(eq(classItemAcceptances.userId, Number(userId)))
    .all()
    .map(r => r.classItemId);

  let query = db.select().from(classItems).where(inArray(classItems.classId, classIds));
  const rows = query.all();

  const filtered = accepted.length
    ? rows.filter(item => !accepted.includes(item.id))
    : rows;

  return filtered.sort((a, b) => b.id - a.id).slice(0, limit);
}

// Returns { alreadyAccepted: true } if this user already accepted this item
// (so callers can avoid creating a duplicate personal record), otherwise
// records the acceptance and returns { alreadyAccepted: false }.
function recordAcceptance(classItemId, userId, personalRecordId) {
  const existing = db
    .select()
    .from(classItemAcceptances)
    .where(and(eq(classItemAcceptances.classItemId, Number(classItemId)), eq(classItemAcceptances.userId, Number(userId))))
    .get();

  if (existing) return { alreadyAccepted: true };

  db.insert(classItemAcceptances)
    .values({ classItemId: Number(classItemId), userId: Number(userId), personalRecordId: personalRecordId || null })
    .run();

  return { alreadyAccepted: false };
}

module.exports = {
  createClass,
  getClassByJoinCode,
  getClassById,
  joinClassByCode,
  isClassMember,
  getUserClasses,
  findOwnedClassByName,
  isClassCreator,
  getNotifiableMembers,
  broadcastItem,
  getClassItemById,
  getPendingItemsForUser,
  recordAcceptance,
};