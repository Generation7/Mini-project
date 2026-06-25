const userService = require('../services/userService');
const { requireFields } = require('../utils/validators');

function createUser(req, res) {
  const errors = requireFields(req.body, ['phoneNumber']);

  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  const user = userService.findOrCreateByPhoneNumber(req.body.phoneNumber);
  return res.status(201).json({ success: true, user });
}

function getUsers(req, res) {
  const phoneNumber = req.query.phoneNumber;

  if (phoneNumber) {
    const user = userService.findByPhoneNumber(phoneNumber);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    return res.status(200).json({ success: true, user });
  }

  return res.status(200).json({ success: true, message: 'Use ?phoneNumber= to search' });
}

module.exports = { createUser, getUsers };
