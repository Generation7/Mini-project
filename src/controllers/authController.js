const userService = require('../services/userService');
const { comparePassword, signToken, toPublicUser } = require('../utils/auth');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function register(req, res) {
  try {
    const { name, email, password, phoneNumber } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password are required' });
    }
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ success: false, message: 'Enter a valid email address' });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }
    if (userService.findByEmail(email)) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists' });
    }

    const user = await userService.registerUser({ name, email, password, phoneNumber });
    const token = signToken(user);
    return res.status(201).json({ success: true, token, user: toPublicUser(user) });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const user = userService.findByEmail(email);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Incorrect email or password' });
    }

    const passwordMatches = await comparePassword(password, user.passwordHash);
    if (!passwordMatches) {
      return res.status(401).json({ success: false, message: 'Incorrect email or password' });
    }

    const token = signToken(user);
    return res.status(200).json({ success: true, token, user: toPublicUser(user) });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

function me(req, res) {
  const user = userService.findById(req.userId);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  return res.status(200).json({ success: true, user: toPublicUser(user) });
}

module.exports = { register, login, me };