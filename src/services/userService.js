const { eq, isNotNull } = require('drizzle-orm');
const { db } = require('../db/client');
const users = require('../models/userModel');
const { hashPassword } = require('../utils/auth');

function findByPhoneNumber(phoneNumber) {
  return db.select().from(users).where(eq(users.phoneNumber, phoneNumber)).get();
}

function findById(id) {
  return db.select().from(users).where(eq(users.id, Number(id))).get();
}

function findByEmail(email) {
  if (!email) return undefined;
  return db.select().from(users).where(eq(users.email, email.toLowerCase())).get();
}

function findByStudentId(studentId) {
  if (!studentId) return undefined;
  return db.select().from(users).where(eq(users.studentId, studentId)).get();
}

function createUser(phoneNumber) {
  return db.insert(users).values({ phoneNumber }).returning().get();
}

function findOrCreateByPhoneNumber(phoneNumber) {
  const existingUser = findByPhoneNumber(phoneNumber);
  if (existingUser) return existingUser;
  return createUser(phoneNumber);
}

async function registerUser({ name, studentId, email, password, phoneNumber }) {
  const passwordHash = await hashPassword(password);

  return db
    .insert(users)
    .values({
      name,
      studentId,
      email: email.toLowerCase(),
      passwordHash,
      phoneNumber: phoneNumber || null,
    })
    .returning()
    .get();
}

function saveTelegramChatId(userId, chatId) {
  db.update(users)
    .set({ telegramChatId: String(chatId) })
    .where(eq(users.id, Number(userId)))
    .run();
}

function findByTelegramChatId(chatId) {
  return db.select().from(users).where(eq(users.telegramChatId, String(chatId))).get();
}
function getAllUsersWithTelegram() {
  return db.select().from(users).where(isNotNull(users.telegramChatId)).all();
}

const TELEGRAM_LINK_TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minutes

function createTelegramLinkToken(userId) {
  const token = require('crypto').randomBytes(16).toString('hex');
  const expiresAt = new Date(Date.now() + TELEGRAM_LINK_TOKEN_TTL_MS).toISOString();

  db.update(users)
    .set({ telegramLinkToken: token, telegramLinkTokenExpiresAt: expiresAt })
    .where(eq(users.id, Number(userId)))
    .run();

  return token;
}

function findByValidTelegramLinkToken(token) {
  if (!token) return undefined;
  const user = db.select().from(users).where(eq(users.telegramLinkToken, token)).get();
  if (!user) return undefined;
  if (!user.telegramLinkTokenExpiresAt || new Date(user.telegramLinkTokenExpiresAt).getTime() < Date.now()) {
    return undefined;
  }
  return user;
}

function linkTelegramChatId(userId, chatId) {
  db.update(users)
    .set({
      telegramChatId: String(chatId),
      telegramLinkToken: null,
      telegramLinkTokenExpiresAt: null,
    })
    .where(eq(users.id, Number(userId)))
    .run();
  return findById(userId);
}

function unlinkTelegramChatId(userId) {
  db.update(users)
    .set({ telegramChatId: null })
    .where(eq(users.id, Number(userId)))
    .run();
  return findById(userId);
}

function findByCalendarToken(token) {
  if (!token) return undefined;
  return db.select().from(users).where(eq(users.calendarToken, token)).get();
}

function getOrCreateCalendarToken(userId) {
  const user = findById(userId);
  if (!user) return null;
  if (user.calendarToken) return user.calendarToken;

  const token = require('crypto').randomBytes(24).toString('hex');
  db.update(users).set({ calendarToken: token }).where(eq(users.id, Number(userId))).run();
  return token;
}

function updateProfile(userId, { name, email, studentId }) {
  const patch = {};
  if (name !== undefined) patch.name = name;
  if (email !== undefined) patch.email = email.toLowerCase();
  if (studentId !== undefined) patch.studentId = studentId;

  db.update(users).set(patch).where(eq(users.id, Number(userId))).run();
  return findById(userId);
}

async function updatePassword(userId, newPassword) {
  const passwordHash = await hashPassword(newPassword);
  db.update(users).set({ passwordHash }).where(eq(users.id, Number(userId))).run();
}

function updateNotificationSettings(userId, { weeklyDigestEnabled, dailySummaryEnabled, remindersEnabled, reminderLeadMinutes }) {
  const patch = {};
  if (weeklyDigestEnabled !== undefined) patch.weeklyDigestEnabled = !!weeklyDigestEnabled;
  if (dailySummaryEnabled !== undefined) patch.dailySummaryEnabled = !!dailySummaryEnabled;
  if (remindersEnabled !== undefined) patch.remindersEnabled = !!remindersEnabled;
  if (reminderLeadMinutes !== undefined) patch.reminderLeadMinutes = Number(reminderLeadMinutes);

  db.update(users).set(patch).where(eq(users.id, Number(userId))).run();
  return findById(userId);
}

function deleteAccount(userId) {
  db.delete(users).where(eq(users.id, Number(userId))).run();
}

module.exports = {
  findById,
  findByPhoneNumber,
  findByEmail,
  findByStudentId,
  createUser,
  registerUser,
  findOrCreateByPhoneNumber,
  saveTelegramChatId,
  findByTelegramChatId,
  getAllUsersWithTelegram,
  createTelegramLinkToken,
  findByValidTelegramLinkToken,
  linkTelegramChatId,
  unlinkTelegramChatId,
  findByCalendarToken,
  getOrCreateCalendarToken,
  updateProfile,
  updatePassword,
  updateNotificationSettings,
  deleteAccount,
};