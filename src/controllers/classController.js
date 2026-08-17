const classService = require('../services/classService');
const actionService = require('../services/actionService');
const logger = require('../utils/logger');

function listMyClasses(req, res) {
  try {
    const myClasses = classService.getUserClasses(req.userId);
    return res.status(200).json({ success: true, classes: myClasses });
  } catch (err) {
    logger.error('Failed to list classes', { userId: req.userId, error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: err.message });
  }
}

function createClass(req, res) {
  try {
    const name = (req.body.name || '').trim();
    if (!name) {
      return res.status(400).json({ success: false, message: 'A class name is required.' });
    }

    const klass = classService.createClass(req.userId, name);
    return res.status(201).json({ success: true, class: klass });
  } catch (err) {
    logger.error('Failed to create class', { userId: req.userId, error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: err.message });
  }
}

function joinClass(req, res) {
  try {
    const joinCode = (req.body.joinCode || '').trim();
    if (!joinCode) {
      return res.status(400).json({ success: false, message: 'A join code is required.' });
    }

    const result = classService.joinClassByCode(req.userId, joinCode);
    if (result.error === 'not_found') {
      return res.status(404).json({ success: false, message: 'No class found with that join code.' });
    }
    if (result.error === 'already_member') {
      return res.status(200).json({ success: true, class: result.class, alreadyMember: true });
    }
    return res.status(200).json({ success: true, class: result.class });
  } catch (err) {
    logger.error('Failed to join class', { userId: req.userId, error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: err.message });
  }
}

function getClassMembers(req, res) {
  try {
    const { classId } = req.params;
    if (!classService.isClassMember(classId, req.userId)) {
      return res.status(403).json({ success: false, message: "You're not a member of this class." });
    }
    const members = classService.getClassMembers(classId);
    return res.status(200).json({ success: true, members });
  } catch (err) {
    logger.error('Failed to get class members', { userId: req.userId, classId: req.params.classId, error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: err.message });
  }
}

const REQUIRED_FIELDS = {
  lecture: ['courseCode', 'lectureDay', 'lectureTime'],
  assignment: ['courseCode', 'title', 'dueDate'],
  exam: ['courseCode', 'examDate'],
};

async function broadcastItem(req, res) {
  try {
    const { classId } = req.params;
    const { type, payload } = req.body;

    if (!REQUIRED_FIELDS[type]) {
      return res.status(400).json({ success: false, message: 'type must be one of lecture, assignment, exam.' });
    }
    const missing = REQUIRED_FIELDS[type].filter(field => !payload || !payload[field]);
    if (missing.length) {
      return res.status(400).json({ success: false, message: `Missing required field(s): ${missing.join(', ')}` });
    }
    if (!classService.isClassCreator(classId, req.userId)) {
      return res.status(403).json({ success: false, message: 'Only the class creator can broadcast to this class.' });
    }

    const klass = classService.getClassById(classId);
    const item = classService.broadcastItem({ classId, creatorId: req.userId, type, payload });

    const summary = describeItem(type, payload);
    const bot = actionService.getTelegramBot();
    await classService.notifyMembers(
      bot,
      klass.id,
      req.userId,
      `📣 New ${type} shared in *${klass.name}*:\n${summary}\n\nReply "accept ${item.id}" in Telegram to add it to your own list.`
    );

    return res.status(201).json({ success: true, item });
  } catch (err) {
    logger.error('Failed to broadcast class item', { userId: req.userId, classId: req.params.classId, error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: err.message });
  }
}

function describeItem(type, payload) {
  if (type === 'lecture') return `${payload.courseCode} - ${payload.lectureDay} at ${payload.lectureTime}`;
  if (type === 'assignment') return `${payload.courseCode} - ${payload.title} (due ${payload.dueDate})`;
  if (type === 'exam') return `${payload.courseCode} exam on ${payload.examDate}${payload.venue ? ` at ${payload.venue}` : ''}`;
  return '';
}

function getPendingUpdates(req, res) {
  try {
    const pending = classService.getPendingItemsForUser(req.userId, 30);
    return res.status(200).json({ success: true, updates: pending });
  } catch (err) {
    logger.error('Failed to get pending class updates', { userId: req.userId, error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: err.message });
  }
}

function acceptUpdate(req, res) {
  try {
    const { itemId } = req.params;
    const result = classService.acceptClassItem(itemId, req.userId);

    if (result.error === 'not_found') {
      return res.status(404).json({ success: false, message: 'Update not found.' });
    }
    if (result.error === 'already_accepted') {
      return res.status(200).json({ success: true, alreadyAccepted: true });
    }
    return res.status(200).json({ success: true, item: result.item });
  } catch (err) {
    logger.error('Failed to accept class update', { userId: req.userId, itemId: req.params.itemId, error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  listMyClasses,
  createClass,
  joinClass,
  getClassMembers,
  broadcastItem,
  getPendingUpdates,
  acceptUpdate,
};