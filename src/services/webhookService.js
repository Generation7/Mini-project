const userService = require('./userService');
const commandParserService = require('./commandParserService');
const ruleService = require('./ruleService');
const lectureService = require('./lectureService');
const eventService = require('./eventService');
const logger = require('../utils/logger');

function extractMessages(body) {
  const changes = body?.entry?.flatMap((entry) => entry.changes || []) || [];
  return changes.flatMap((change) => change.value?.messages || []);
}

function getTextFromMessage(message) {
  return message?.text?.body || '';
}

function handleIncomingWebhook(body) {
  const messages = extractMessages(body);

  for (const item of messages) {
    const senderPhone = item.from;
    const message = getTextFromMessage(item);

    if (!senderPhone) continue;

    const user = userService.findOrCreateByPhoneNumber(senderPhone);
    const command = commandParserService.parseCommand(message);

    if (command.errors && command.errors.length > 0) {
      logger.info('Invalid WhatsApp command', {
        userId: user.id,
        senderPhone,
        message,
        errors: command.errors,
      });
    }

    if (command.type === commandParserService.COMMAND_TYPES.ADD_RULE && command.isValid) {
      const rule = ruleService.createRule({
        userId: user.id,
        trigger: command.data.trigger,
        condition: command.data.condition,
        action: command.data.action,
      });

      logger.info('Rule created', {
        userId: user.id,
        ruleId: rule.id,
        trigger: rule.trigger,
        action: rule.action,
      });
    }

    if (command.type === commandParserService.COMMAND_TYPES.ADD_LECTURE && command.isValid) {
      const result = lectureService.createLecture({
        userId: user.id,
        courseCode: command.data.courseCode,
        courseName: command.data.courseName,
        lectureDay: command.data.lectureDay,
        lectureTime: command.data.lectureTime,
      });

      logger.info(result.created ? 'Lecture created' : 'Duplicate lecture ignored', {
        userId: user.id,
        lectureId: result.lecture.id,
        courseCode: result.lecture.courseCode,
        lectureDay: result.lecture.lectureDay,
        lectureTime: result.lecture.lectureTime,
      });
    }

    logger.info('Incoming WhatsApp message', {
      userId: user.id,
      senderPhone,
      message,
      command,
    });

    eventService.processEvent({
      type: 'whatsapp_message_received',
      data: {
        userId: user.id,
        senderPhone,
        message,
        commandType: command.type,
      },
    });
  }

  return { received: true, messageCount: messages.length };
}

module.exports = { handleIncomingWebhook };