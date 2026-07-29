const logger = require('./logger');

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 1000;

// Error codes that indicate the request never actually reached Telegram
// (DNS hiccup, dropped connection, timeout, etc) - the kind of thing that's
// common on a flaky mobile hotspot and usually succeeds on retry.
const RETRYABLE_CODES = new Set(['EFATAL', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED', 'EAI_AGAIN', 'EPIPE']);

function isRetryableError(err) {
  if (!err) return false;

  // node-telegram-bot-api attaches `response` when Telegram itself answered
  // with an error (bad chat id, bot blocked by user, bad markdown, etc).
  // Retrying those wastes time - they'll fail the same way every time.
  if (err.response) return false;

  const code = err.code || (err.cause && err.cause.code);
  if (code && RETRYABLE_CODES.has(code)) return true;

  const message = (err.message || '').toLowerCase();
  if (message.includes('fetch failed') || message.includes('network') || message.includes('timeout') || message.includes('socket hang up')) {
    return true;
  }

  return false;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Runs `fn` (which should perform one Telegram API call) with retries on
 * transient network failures. Non-retryable errors (genuine Telegram API
 * rejections) are thrown immediately on the first attempt.
 *
 * @param {() => Promise<any>} fn
 * @param {{ maxAttempts?: number, baseDelayMs?: number, label?: string }} opts
 */
async function withTelegramRetry(fn, opts = {}) {
  const maxAttempts = opts.maxAttempts || DEFAULT_MAX_ATTEMPTS;
  const baseDelayMs = opts.baseDelayMs || DEFAULT_BASE_DELAY_MS;
  const label = opts.label || 'telegram_call';

  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const retryable = isRetryableError(err);

      if (!retryable) {
        logger.error(`${label} failed (non-retryable): ${err.message}`);
        throw err;
      }

      if (attempt === maxAttempts) {
        logger.error(`${label} failed after ${maxAttempts} attempts: ${err.message}`);
        throw err;
      }

      const waitMs = baseDelayMs * Math.pow(2, attempt - 1);
      console.warn(`${label} attempt ${attempt}/${maxAttempts} failed (${err.message}), retrying in ${waitMs}ms...`);
      await delay(waitMs);
    }
  }
  throw lastErr;
}

// Convenience wrapper for the most common case.
function sendMessageWithRetry(bot, chatId, text, options, retryOpts = {}) {
  return withTelegramRetry(
    () => bot.sendMessage(chatId, text, options),
    { label: `sendMessage(chat ${chatId})`, ...retryOpts }
  );
}

module.exports = { withTelegramRetry, sendMessageWithRetry, isRetryableError };