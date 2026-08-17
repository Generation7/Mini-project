const userService = require('../services/userService');
const { comparePassword, signToken, toPublicUser } = require('../utils/auth');
const { getGoogleAuthUrl, exchangeCodeForProfile } = require('../services/googleAuthService');
const logger = require('../utils/logger');

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
    logger.error('Failed to register user', { email: req.body && req.body.email, error: err.message, stack: err.stack });
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
    logger.error('Failed to log in user', { email: req.body && req.body.email, error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: err.message });
  }
}

function me(req, res) {
  const user = userService.findById(req.userId);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  return res.status(200).json({ success: true, user: toPublicUser(user) });
}

// Kicks off Google sign-in by sending the browser to Google's consent screen.
function googleRedirect(req, res) {
  return res.redirect(getGoogleAuthUrl());
}

// Google redirects back here with ?code=... after the user approves.
// Exchanges that code for their profile, finds or creates a matching
// account by email, then hands back our own JWT the same way login/register
// do - by redirecting to the frontend with the token in the URL, since this
// is a full-page redirect flow rather than an API call the frontend made.
async function googleCallback(req, res) {
  try {
    const { code, error } = req.query;

    if (error) {
      return res.redirect('/?error=google_auth_failed');
    }
    if (!code) {
      return res.status(400).send('Missing authorization code from Google');
    }

    const profile = await exchangeCodeForProfile(code);

    if (profile.email_verified === false) {
      return res.redirect('/?error=google_email_unverified');
    }

    const user = await userService.findOrCreateGoogleUser({
      name: profile.name,
      email: profile.email,
    });

    const token = signToken(user);
    return res.redirect(`/?token=${encodeURIComponent(token)}`);
  } catch (err) {
    logger.error('Google OAuth error', { error: err.message, stack: err.stack });
    return res.redirect('/?error=google_auth_failed');
  }
}

module.exports = { register, login, me, googleRedirect, googleCallback };