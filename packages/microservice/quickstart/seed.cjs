const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const rawUrl = process.env.DATABASE_URL || 'sqlite:///data/quickstart.db';
let dbPath = rawUrl.replace(/^sqlite:\/\//, '');
if (!dbPath) dbPath = '/data/quickstart.db';

const sqlPath = path.join(__dirname, 'seed.sql');

console.log(`[AskChokro Quickstart] Initializing database at ${dbPath}...`);
const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const db = new Database(dbPath);
const seedSql = fs.readFileSync(sqlPath, 'utf8');
db.exec(seedSql);
console.log(`[AskChokro Quickstart] Database schema & seed data ready at ${dbPath}!`);
db.close();
