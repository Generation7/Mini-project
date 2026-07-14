const { eq } = require('drizzle-orm');
const { db } = require('../db/client');
const { users } = require('../db/schema');

function findByPhoneNumber(phoneNumber) {
  return db.select().from(users).where(eq(users.phoneNumber, phoneNumber)).get();
}

function findById(id) {
  return db.select().from(users).where(eq(users.id, Number(id))).get();
}

function createUser({ phoneNumber, name }) {
  return db.insert(users).values({ phoneNumber, name }).returning().get();
}

function findOrCreateByPhoneNumber(phoneNumber) {
  const existingUser = findByPhoneNumber(phoneNumber);
  if (existingUser) return existingUser;

  // This is a simplified version, assuming name is available or not strictly needed here
  return createUser({ phoneNumber, name: `User ${phoneNumber}` });
}

function saveTelegramChatId(userId, chatId) {
  db.update(users).set({ telegramChatId: chatId.toString() })
    .where(eq(users.id, Number(userId))).run();
}

module.exports = { 
  findById, 
  findByPhoneNumber, 
  createUser,
  findOrCreateByPhoneNumber,
  saveTelegramChatId,
};