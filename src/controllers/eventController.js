const eventService = require('../services/eventService');
const { requireFields } = require('../utils/validators');
const logger = require('../utils/logger');

function createEvent(req, res) {
  try {
    const errors = requireFields(req.body, ['type']);

    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    const result = eventService.processEvent(req.body);

    return res.status(201).json({
      event: result.event,
      actions: result.actions,
    });
  } catch (err) {
    logger.error('Failed to process event', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { createEvent };