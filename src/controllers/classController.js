const classService = require('../services/classService');
const actionService = require('../services/actionService');

function listMyClasses(req, res) {
  const myClasses = classService.getUserClasses(req.userId);
  return res.status(200).json({ success: true, classes: myClasses });
}

function createClass(req, res) {
  const name = (req.body.name || '').trim();
  if (!name) {
    return res.status(400).json({ success: false, message: 'A class name is required.' });
  }

  const klass = classService.createClass(req.userId, name);
  return res.status(201).json({ success: true, class: klass });
}

function joinClass(req, res) {
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
}

function getClassMembers(req, res) {
  const { classId } = req.params;
  if (!classService.isClassMember(classId, req.userId)) {
    return res.status(403).json({ success: false, message: "You're not a member of this class." });
  }
  const members = classService.getClassMembers(classId);
  return res.status(200).json({ success: true, members });
}

const REQUIRED_FIELDS = {
  lecture: ['courseCode', 'lectureDay', 'lectureTime'],
  assignment: ['courseCode', 'title', 'dueDate'],
  exam: ['courseCode', 'examDate'],
};

async function broadcastItem(req, res) {
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
}

function describeItem(type, payload) {
  if (type === 'lecture') return `${payload.courseCode} - ${payload.lectureDay} at ${payload.lectureTime}`;
  if (type === 'assignment') return `${payload.courseCode} - ${payload.title} (due ${payload.dueDate})`;
  if (type === 'exam') return `${payload.courseCode} exam on ${payload.examDate}${payload.venue ? ` at ${payload.venue}` : ''}`;
  return '';
}

function getPendingUpdates(req, res) {
  const pending = classService.getPendingItemsForUser(req.userId, 30);
  return res.status(200).json({ success: true, updates: pending });
}

function acceptUpdate(req, res) {
  const { itemId } = req.params;
  const result = classService.acceptClassItem(itemId, req.userId);

  if (result.error === 'not_found') {
    return res.status(404).json({ success: false, message: 'Update not found.' });
  }
  if (result.error === 'already_accepted') {
    return res.status(200).json({ success: true, alreadyAccepted: true });
  }
  return res.status(200).json({ success: true, item: result.item });
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