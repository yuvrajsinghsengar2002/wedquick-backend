require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const db   = require('../config/db');

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`▶  Running ${statements.length} SQL statements…`);
  for (const stmt of statements) {
    try {
      await db.query(stmt);
      process.stdout.write('.');
    } catch (err) {
      console.error('\n❌  Failed statement:\n', stmt);
      console.error('Error:', err.message);
    }
  }
  console.log('\n✅  Migration complete');
  process.exit(0);
}

migrate();
