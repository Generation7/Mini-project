const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { drizzle } = require('drizzle-orm/better-sqlite3');
const env = require('../config/env');
const schema = require('./schema');

const dbPath = path.resolve(process.cwd(), env.databaseUrl);
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const sqlite = new Database(dbPath);
const db = drizzle(sqlite, { schema });

module.exports = { db, sqlite };
