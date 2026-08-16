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
// fs.mkdirSync below would silently create a *local, non-persistent*
// directory instead of using the real volume, and every write from then on
// goes to storage that gets wiped on the next deploy. This has caused
// silent, intermittent data loss (users/lectures disappearing across
// redeploys) even though the volume itself was correctly configured.
//
// /proc/mounts lists every currently-mounted filesystem. A properly
// attached Railway volume shows up here as its own mount point; a plain
// directory the app created itself does not. We use this to tell the two
// apart, and retry with a short backoff instead of silently proceeding on
// whatever happens to exist at dbDir yet.
function isMountedVolume(targetDir) {
  try {
    const mounts = fs.readFileSync('/proc/mounts', 'utf8');
    const normalizedTarget = path.resolve(targetDir);
    return mounts
      .split('\n')
      .some(line => {
        const mountPoint = line.split(' ')[1];
        return mountPoint === normalizedTarget;
      });
  } catch (err) {
    // /proc/mounts isn't available on every platform (e.g. local Windows
    // dev) - in that case we can't verify either way, so don't block
    // startup over it.
    console.log('Could not read /proc/mounts to verify volume mount:', err.message);
    return null;
  }
}

function waitForVolumeMount(targetDir, { retries = 10, delayMs = 500 } = {}) {
  // Only relevant when the target path looks like a Railway volume mount
  // (absolute path under a dedicated directory like /data). Local/dev
  // paths should never be delayed.
  if (!path.isAbsolute(targetDir) || targetDir === path.resolve(process.cwd())) {
    return;
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    const mounted = isMountedVolume(targetDir);

    if (mounted === true) {
      console.log(`Confirmed ${targetDir} is a mounted persistent volume.`);
      return;
    }

    if (mounted === null) {
      // Can't verify on this platform - proceed without blocking.
      return;
    }

    if (attempt === retries) {
      console.log(
        `WARNING: ${targetDir} does not appear as a mounted volume after ${retries} attempts. ` +
        `Proceeding anyway, but data written here may NOT persist across the next deploy. ` +
        `Check Railway Settings > Volumes to confirm the mount is attached.`
      );
      return;
    }

    console.log(`${targetDir} not yet mounted as a volume, retrying (${attempt}/${retries})...`);
    // Synchronous sleep - acceptable here since this only runs once at
    // process startup, before the server begins accepting requests.
    const waitUntil = Date.now() + delayMs;
    while (Date.now() < waitUntil) { /* busy-wait */ }
  }
}

waitForVolumeMount(dbDir);

fs.mkdirSync(dbDir, { recursive: true });

const sqlite = new Database(dbPath);
const db = drizzle(sqlite, { schema });

module.exports = { db, sqlite };