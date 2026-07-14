const userService = require('../services/userService');
const { requireFields } = require('../utils/validators');
const { comparePassword, signToken, toPublicUser } = require('../utils/auth');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function register(req, res) {
  try {
    const errors = requireFields(req.body, ['name', 'studentId', 'email', 'password']);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    const { name, studentId, email, password, phoneNumber } = req.body;

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ success: false, message: 'Enter a valid email address' });
    }

    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }

    if (userService.findByEmail(email)) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists' });
    }

    if (userService.findByStudentId(studentId)) {
      return res.status(409).json({ success: false, message: 'An account with this student ID already exists' });
    }

    const user = await userService.registerUser({ name, studentId, email, password, phoneNumber });
    const token = signToken(user);

    return res.status(201).json({ success: true, token, user: toPublicUser(user) });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function login(req, res) {
  try {
    const errors = requireFields(req.body, ['password']);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    const { email, studentId, password } = req.body;

    if (!email && !studentId) {
      return res.status(400).json({ success: false, message: 'Enter your email or student ID' });
    }

    const user = email ? userService.findByEmail(email) : userService.findByStudentId(studentId);

    if (!user) {
      return res.status(401).json({ success: false, message: 'Incorrect login details' });
    }

    const passwordMatches = await comparePassword(password, user.passwordHash);
    if (!passwordMatches) {
      return res.status(401).json({ success: false, message: 'Incorrect login details' });
    }

    const token = signToken(user);
    return res.status(200).json({ success: true, token, user: toPublicUser(user) });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

function me(req, res) {
  const user = userService.findById(req.userId);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }
  return res.status(200).json({ success: true, user: toPublicUser(user) });
}

module.exports = { register, login, me };