const { eq } = require('drizzle-orm');
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

// Registers a new student account with a hashed password.
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

// chatId is untrusted input from Telegram, so this must stay parameterized.
function saveTelegramChatId(userId, chatId) {
  db.update(users)
    .set({ telegramChatId: String(chatId) })
    .where(eq(users.id, Number(userId)))
    .run();
}

function findByTelegramChatId(chatId) {
  return db.select().from(users).where(eq(users.telegramChatId, String(chatId))).get();
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
};