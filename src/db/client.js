const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { drizzle } = require('drizzle-orm/better-sqlite3');
const env = require('../config/env');
const schema = require('./schema');

const dbPath = path.resolve(process.cwd(), env.databaseUrl);
const dbDir = path.dirname(dbPath);

// Railway volumes attach asynchronously - the container can start running
// app code before the mount at /data is actually ready. If that happens,
// the app would silently create a *local, non-persistent* directory
// instead of using the real volume, and every write from then on goes to
// storage that gets wiped on the next deploy. This has caused silent,
// intermittent data loss (users/lectures disappearing across redeploys)
// even though the volume itself is correctly configured in Railway's
// settings - it's a timing race, not a config mistake, and it does not
// happen on every deploy (confirmed: it succeeded on one deploy and
// failed on the very next one with identical code).
//
// /proc/mounts lists every currently-mounted filesystem. A properly
// attached Railway volume shows up here as its own mount point; a plain
// directory the app created itself does not.
function isMountedVolume(targetDir) {
  try {
    const mounts = fs.readFileSync('/proc/mounts', 'utf8');
    const normalizedTarget = path.resolve(targetDir);
    return mounts
      .split('\n')
      .some(line => line.split(' ')[1] === normalizedTarget);
  } catch (err) {
    // /proc/mounts isn't available on every platform (e.g. local Windows
    // dev) - in that case we can't verify either way, so don't block
    // startup over it.
    console.log('Could not read /proc/mounts to verify volume mount:', err.message);
    return null;
  }
}

// True blocking sleep (not a CPU busy-wait spin loop) using Atomics.wait
// on a throwaway SharedArrayBuffer. Safe to use here because this only
// runs once, synchronously, at process startup before the server begins
// accepting requests - there's nothing else this process should be doing
// during this wait.
function sleepSync(ms) {
  const sab = new SharedArrayBuffer(4);
  const view = new Int32Array(sab);
  Atomics.wait(view, 0, 0, ms);
}

// Waits for /data to appear as a real mounted volume before letting the
// app touch the database. On Railway (identified by RAILWAY_ENVIRONMENT
// being set) an unresolved mount after the timeout throws, which crashes
// the process - a visible crash-loop in Railway's dashboard is far safer
// than silently running on ephemeral storage and losing data without any
// indication anything went wrong. Railway will keep restarting the
// container on a crash, and each restart gives the volume another chance
// to attach before the app tries to use it.
function waitForVolumeMount(targetDir, { timeoutMs = 30000, intervalMs = 500 } = {}) {
  if (!path.isAbsolute(targetDir) || targetDir === path.resolve(process.cwd())) {
    return; // local/dev path, not a volume mount - nothing to verify
  }

  const isRailway = Boolean(process.env.RAILWAY_ENVIRONMENT);
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const mounted = isMountedVolume(targetDir);

    if (mounted === true) {
      console.log(`Confirmed ${targetDir} is a mounted persistent volume.`);
      return;
    }

    if (mounted === null) {
      return; // can't verify on this platform, proceed without blocking
    }

    console.log(`${targetDir} not yet mounted as a volume, waiting...`);
    sleepSync(intervalMs);
  }

  const message =
    `${targetDir} did not appear as a mounted volume after ${timeoutMs / 1000}s. ` +
    `Refusing to start against unverified storage to avoid silent data loss. ` +
    `Check Railway Settings > Volumes to confirm the mount is attached to this service.`;

  if (isRailway) {
    // Crash loudly on Railway so this is impossible to miss and the
    // platform retries the deploy instead of quietly losing data.
    throw new Error(message);
  }

  console.log(`WARNING: ${message} Proceeding anyway (non-Railway environment).`);
}

waitForVolumeMount(dbDir);

fs.mkdirSync(dbDir, { recursive: true });

const sqlite = new Database(dbPath);
const db = drizzle(sqlite, { schema });

module.exports = { db, sqlite };