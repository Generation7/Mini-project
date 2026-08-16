const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { drizzle } = require('drizzle-orm/better-sqlite3');
const env = require('../config/env');
const schema = require('./schema');

const dbPath = path.resolve(process.cwd(), env.databaseUrl);
const dbDir = path.dirname(dbPath);

// Diagnostic-only check: logs whether /data shows up in /proc/mounts as a
// real mounted volume, purely for visibility in the deploy logs. This is
// NOT used to block or crash startup - an earlier version of this file
// did that, and it turned out to produce false "not mounted" warnings
// even on deploys where persistence genuinely worked, which caused a real
// production outage. Until there's a more reliable way to verify the
// mount from inside the app, we log what we see and let the app start
// regardless.
function logVolumeMountStatus(targetDir) {
  try {
    const mounts = fs.readFileSync('/proc/mounts', 'utf8');
    const normalizedTarget = path.resolve(targetDir);
    const mounted = mounts
      .split('\n')
      .some(line => line.split(' ')[1] === normalizedTarget);

    console.log(
      mounted
        ? `${targetDir} appears as a mounted volume in /proc/mounts.`
        : `${targetDir} does NOT appear as a mounted volume in /proc/mounts (this check has previously produced false negatives - not a reliable signal on its own).`
    );
  } catch (err) {
    console.log('Could not read /proc/mounts to check volume mount status:', err.message);
  }
}

logVolumeMountStatus(dbDir);

console.log(
  `[DB] DATABASE_URL env var: ${process.env.DATABASE_URL ? `"${process.env.DATABASE_URL}"` : '(not set, using default)'} | ` +
  `Resolved database file: ${dbPath} | ` +
  `Directory being checked for persistence: ${dbDir}`
);
if (!path.isAbsolute(env.databaseUrl) || !dbPath.startsWith('/data' + path.sep)) {
  console.log(
    `[DB] WARNING: resolved database path "${dbPath}" is NOT inside the mounted volume at /data. ` +
    `If a Railway volume is attached at /data, set the DATABASE_URL variable to an absolute path like ` +
    `"/data/app.db" or this database will live on ephemeral storage and be wiped on redeploy.`
  );
}

fs.mkdirSync(dbDir, { recursive: true });

const sqlite = new Database(dbPath);
const db = drizzle(sqlite, { schema });

module.exports = { db, sqlite };