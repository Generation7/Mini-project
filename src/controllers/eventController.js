const eventService = require('../services/eventService');
const { requireFields } = require('../utils/validators');

function createEvent(req, res) {
  const errors = requireFields(req.body, ['type']);

  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  const result = eventService.processEvent(req.body);

  return res.status(201).json({
    event: result.event,
    actions: result.actions,
  });
}

module.exports = { createEvent };