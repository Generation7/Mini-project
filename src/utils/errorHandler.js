const logger = require('./logger');

function notFoundHandler(req, res, next) {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
}

function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;

  // Safety net: logs any error that reaches the central Express error
  // handler (e.g. a synchronous throw from a controller with no try/catch
  // of its own) so it's visible in Railway logs instead of vanishing.
  // Controllers that catch their own errors should still log them at the
  // point of the catch - this only covers what slips past that.
  // 404s are routine and expected, so they're not logged here.
  if (statusCode >= 500) {
    logger.error('Unhandled request error', {
      method: req.method,
      url: req.originalUrl,
      error: err.message,
      stack: err.stack,
    });
  }

  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal server error',
  });
}

module.exports = { notFoundHandler, errorHandler };