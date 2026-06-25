const { eq } = require('drizzle-orm');
const { db } = require('../db/client');
const users = require('../models/userModel');

function findByPhoneNumber(phoneNumber) {
  return db.select().from(users).where(eq(users.phoneNumber, phoneNumber)).get();
}

function findById(id) {
  return db.select().from(users).where(eq(users.id, id)).get();
}

function createUser(phoneNumber) {
  return db.insert(users).values({ phoneNumber }).returning().get();
}

function findOrCreateByPhoneNumber(phoneNumber) {
  const existingUser = findByPhoneNumber(phoneNumber);
  if (existingUser) return existingUser;

  return createUser(phoneNumber);
}

module.exports = { findById, findByPhoneNumber, createUser, findOrCreateByPhoneNumber };