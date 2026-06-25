const COMMAND_TYPES = {
  ADD_RULE: 'ADD_RULE',
  ADD_LECTURE: 'ADD_LECTURE',
  LIST_RULES: 'LIST_RULES',
  LIST_LECTURES: 'LIST_LECTURES',
  UNKNOWN: 'UNKNOWN',
};

function normalizeMessage(message = '') {
  return message.trim().replace(/\s+/g, ' ');
}

function parseAddLectureCommand(message) {
  const parts = normalizeMessage(message).split(' ');
  const courseCode = parts[2] || null;
  const lectureDay = parts[3] || null;
  const lectureTime = parts[4] || null;
  const errors = [];

  if (!courseCode) errors.push('Course code is required');
  if (!lectureDay) errors.push('Lecture day is required');
  if (!lectureTime) errors.push('Lecture time is required');
  if (lectureTime && !/^\d{2}:\d{2}$/.test(lectureTime)) {
    errors.push('Lecture time must use HH:MM format');
  }

  return {
    type: COMMAND_TYPES.ADD_LECTURE,
    raw: message,
    data: {
      courseCode,
      courseName: courseCode,
      lectureDay,
      lectureTime,
    },
    isValid: errors.length === 0,
    errors,
  };
}

function parseAddRuleCommand(message) {
  const ruleText = normalizeMessage(message).replace(/^ADD RULE\s*/i, '').trim();
  const ruleCommand = parseIfThenRule(ruleText || message);

  return {
    type: COMMAND_TYPES.ADD_RULE,
    raw: message,
    data: ruleCommand.data,
    isValid: ruleCommand.isValid,
    errors: ruleCommand.errors,
  };
}

function parseIfThenRule(message) {
  const normalized = normalizeMessage(message);
  const match = normalized.match(/^IF\s+(.+?)\s+THEN\s+(.+)$/i);

  if (!match) {
    return {
      type: COMMAND_TYPES.ADD_RULE,
      raw: message,
      data: {
        trigger: null,
        condition: {},
        action: null,
      },
      isValid: false,
      errors: ['Rule must follow this format: IF <trigger> THEN <action>'],
    };
  }

  const trigger = match[1].trim();
  const action = match[2].trim();
  const errors = [];

  if (!trigger) errors.push('Trigger is required');
  if (!action) errors.push('Action is required');

  return {
    type: COMMAND_TYPES.ADD_RULE,
    raw: message,
    data: {
      trigger,
      condition: {},
      action,
    },
    isValid: errors.length === 0,
    errors,
  };
}

function parseCommand(message = '') {
  const normalized = normalizeMessage(message);
  const upper = normalized.toUpperCase();

  if (upper.startsWith('ADD LECTURE')) {
    return parseAddLectureCommand(normalized);
  }

  if (upper.startsWith('IF ')) {
    return parseIfThenRule(normalized);
  }

  if (upper.startsWith('ADD RULE')) {
    return parseAddRuleCommand(normalized);
  }

  if (upper === 'LIST RULES') {
    return {
      type: COMMAND_TYPES.LIST_RULES,
      raw: message,
      data: {},
    };
  }

  if (upper === 'LIST LECTURES') {
    return {
      type: COMMAND_TYPES.LIST_LECTURES,
      raw: message,
      data: {},
    };
  }

  return {
    type: COMMAND_TYPES.UNKNOWN,
    raw: message,
    data: {},
  };
}

module.exports = { COMMAND_TYPES, parseCommand };