const { db } = require('../db/client');
const rules = require('../models/ruleModel');
const { eq } = require('drizzle-orm');

function createRule({ userId, trigger, condition = {}, action }) {
  return db
    .insert(rules)
    .values({
      userId,
      trigger,
      condition,
      action: { type: action },
    })
    .returning()
    .get();
}

function getRulesByTrigger(trigger) {
  return db.select().from(rules).where(eq(rules.trigger, trigger)).all();
}

module.exports = { createRule, getRulesByTrigger };