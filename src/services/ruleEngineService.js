const ruleService = require('./ruleService');

function matchCondition(condition = {}, eventData = {}) {
  if (!condition || Object.keys(condition).length === 0) {
    return true;
  }

  return Object.entries(condition).every(([key, expectedValue]) => {
    return eventData[key] === expectedValue;
  });
}

function processEvent(event) {
  const rules = ruleService.getRulesByTrigger(event.trigger);

  return rules
    .filter((rule) => matchCondition(rule.condition, event.data || {}))
    .map((rule) => ({
      ruleId: rule.id,
      userId: rule.userId,
      action: rule.action,
    }));
}

module.exports = { matchCondition, processEvent };