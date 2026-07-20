const userService = require('../services/userService');
const { comparePassword, toPublicUser } = require('../utils/auth');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function updateProfile(req, res) {
  try {
    const { name, email, studentId } = req.body;

    if (email !== undefined && !EMAIL_REGEX.test(email)) {
      return res.status(400).json({ success: false, message: 'Enter a valid email address' });
    }
    if (email !== undefined) {
      const existing = userService.findByEmail(email);
      if (existing && existing.id !== req.userId) {
        return res.status(409).json({ success: false, message: 'An account with this email already exists' });
      }
    }
    if (studentId !== undefined && studentId !== '') {
      const existing = userService.findByStudentId(studentId);
      if (existing && existing.id !== req.userId) {
        return res.status(409).json({ success: false, message: 'That student ID is already in use' });
      }
    }

    const user = userService.updateProfile(req.userId, { name, email, studentId });
    return res.json({ success: true, user: toPublicUser(user) });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function updatePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current and new password are required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'New password must be at least 8 characters' });
    }

    const user = userService.findById(req.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const matches = await comparePassword(currentPassword, user.passwordHash);
    if (!matches) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    await userService.updatePassword(req.userId, newPassword);
    return res.json({ success: true, message: 'Password updated' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

function updateNotifications(req, res) {
  try {
    const { weeklyDigestEnabled, dailySummaryEnabled, remindersEnabled, reminderLeadMinutes } = req.body;

    if (reminderLeadMinutes !== undefined) {
      const mins = Number(reminderLeadMinutes);
      if (!Number.isFinite(mins) || mins < 0 || mins > 10080) {
        return res.status(400).json({ success: false, message: 'reminderLeadMinutes must be between 0 and 10080 (7 days)' });
      }
    }

    const user = userService.updateNotificationSettings(req.userId, {
      weeklyDigestEnabled,
      dailySummaryEnabled,
      remindersEnabled,
      reminderLeadMinutes,
    });
    return res.json({ success: true, user: toPublicUser(user) });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function deleteAccount(req, res) {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ success: false, message: 'Password is required to delete your account' });
    }

    const user = userService.findById(req.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const matches = await comparePassword(password, user.passwordHash);
    if (!matches) {
      return res.status(401).json({ success: false, message: 'Incorrect password' });
    }

    userService.deleteAccount(req.userId);
    return res.json({ success: true, message: 'Account deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { updateProfile, updatePassword, updateNotifications, deleteAccount };