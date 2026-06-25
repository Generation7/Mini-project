const { db } = require('../db/client');
const events = require('../models/eventModel');
const ruleEngineService = require('./ruleEngineService');
const actionService = require('./actionService');
const logger = require('../utils/logger');

function createEvent({ type, data = {} }) {
  const event = db.insert(events).values({ type, data }).returning().get();
  logger.info('Event saved', { eventId: event.id, type: event.type });
  return event;
}

function processEvent({ type, data = {} }) {
  const event = createEvent({ type, data });
  const actions = ruleEngineService.processEvent({
    trigger: type,
    data,
  });

  return { event, actions };
}

async function processEventAndExecuteActions({ type, data = {} }) {
  const result = processEvent({ type, data });
  const actionResults = [];

  for (const action of result.actions) {
    actionResults.push(await actionService.sendRuleNotification(action));
  }

  return { ...result, actionResults };
}

module.exports = { createEvent, processEvent, processEventAndExecuteActions };