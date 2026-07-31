const { eq, desc, inArray } = require('drizzle-orm');
const { db } = require('../db/client');
const conversationMessages = require('../models/conversationMessageModel');

// How many messages (user + assistant combined) get sent to Groq as context
// on each turn. Kept small on purpose - this is a lightweight academic
// assistant, not a long-form chat product, and a smaller window keeps
// latency/token cost down.
const HISTORY_LIMIT = 12;

// How many rows per user we keep in the DB at all before pruning older ones.
// Larger than HISTORY_LIMIT so there's a bit of headroom if that constant
// gets bumped up later without needing a data backfill.
const MAX_STORED_PER_USER = 40;

function addMessage(userId, role, content) {
  db.insert(conversationMessages)
    .values({ userId: Number(userId), role, content })
    .run();

  pruneOldMessages(userId, MAX_STORED_PER_USER);
}

// Returns the last `limit` messages for a user in chronological order
// (oldest first) - the order the Groq messages array expects.
function getRecentMessages(userId, limit = HISTORY_LIMIT) {
  const rows = db
    .select()
    .from(conversationMessages)
    .where(eq(conversationMessages.userId, Number(userId)))
    .orderBy(desc(conversationMessages.id))
    .limit(limit)
    .all();

  return rows.reverse();
}

function pruneOldMessages(userId, keep) {
  const idsToDelete = db
    .select({ id: conversationMessages.id })
    .from(conversationMessages)
    .where(eq(conversationMessages.userId, Number(userId)))
    .orderBy(desc(conversationMessages.id))
    .all()
    .slice(keep)
    .map(row => row.id);

  if (idsToDelete.length) {
    db.delete(conversationMessages).where(inArray(conversationMessages.id, idsToDelete)).run();
  }
}

function clearHistory(userId) {
  db.delete(conversationMessages).where(eq(conversationMessages.userId, Number(userId))).run();
}

module.exports = { addMessage, getRecentMessages, clearHistory, HISTORY_LIMIT };