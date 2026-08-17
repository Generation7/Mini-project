const userService = require('../services/userService');
const { requireFields } = require('../utils/validators');
const logger = require('../utils/logger');

function createUser(req, res) {
  try {
    const errors = requireFields(req.body, ['phoneNumber']);

    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    const user = userService.findOrCreateByPhoneNumber(req.body.phoneNumber);
    return res.status(201).json({ success: true, user });
  } catch (err) {
    logger.error('Failed to create user', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: err.message });
  }
}

function getUsers(req, res) {
  try {
    const phoneNumber = req.query.phoneNumber;

    if (phoneNumber) {
      const user = userService.findByPhoneNumber(phoneNumber);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
      return res.status(200).json({ success: true, user });
    }

    return res.status(200).json({ success: true, message: 'Use ?phoneNumber= to search' });
  } catch (err) {
    logger.error('Failed to get users', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { createUser, getUsers };
