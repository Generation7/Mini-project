const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');

const SALT_ROUNDS = 10;
const TOKEN_EXPIRY = '7d';

function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

function comparePassword(plainPassword, passwordHash) {
  if (!passwordHash) return Promise.resolve(false);
  return bcrypt.compare(plainPassword, passwordHash);
}

function signToken(user) {
  return jwt.sign(
    { userId: user.id, studentId: user.studentId, email: user.email },
    env.jwtSecret,
    { expiresIn: TOKEN_EXPIRY }
  );
}

function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret);
}

function toPublicUser(user) {
  if (!user) return null;
  const { passwordHash, ...publicUser } = user;
  return publicUser;
}

module.exports = { hashPassword, comparePassword, signToken, verifyToken, toPublicUser };