// check-approval-chain-users.js
// Diagnostic only — makes no changes. Confirms whether "Medical Director",
// "Chief Nursing Officer", "Chief Admin Officer", and "CEO" each map to
// exactly one active user (via their `position` field), and lists every
// department with its head_doctor_id, so we can build the expense
// chain-of-command approval logic on solid ground.
//
// Run: node check-approval-chain-users.js

const fs = require('fs');
const { Client } = require('pg');

const ENV_PATH = '/Users/adminnopassword/Documents/Clinical MS/cms/backend/.env';

function loadEnv(p) {
  const out = {};
  if (!fs.existsSync(p)) return out;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    out[m[1]] = val;
  }
  return out;
}

const TITLES = [
  'medical director',
  'chief nursing officer',
  'chief admin officer',
  'chief executive officer',
  'ceo',
];

async function main() {
  const env = { ...loadEnv(ENV_PATH), ...process.env };
  const client = new Client({
    host: env.DB_HOST || 'localhost',
    port: Number(env.DB_PORT || 5432),
    user: env.DB_USERNAME || 'postgres',
    password: env.DB_PASSWORD || '',
    database: env.DB_NAME || 'cms',
  });

  console.log(`Connecting to postgres://${client.user}@${client.host}:${client.port}/${client.database} ...\n`);
  await client.connect();

  console.log('=== Users whose position matches a top-level title ===');
  const placeholders = TITLES.map((_, i) => `$${i + 1}`).join(',');
  const topUsers = await client.query(
    `SELECT username, first_name, last_name, position, department_id, status
     FROM users
     WHERE LOWER(TRIM(position)) IN (${placeholders})
     ORDER BY LOWER(TRIM(position))`,
    TITLES
  );
  if (topUsers.rows.length === 0) {
    console.log('  (none found — these titles are not stored in users.position)');
  } else {
    console.table(topUsers.rows);
  }

  console.log('\n=== Distinct position values currently in use (to spot naming mismatches) ===');
  const allPositions = await client.query(
    `SELECT DISTINCT position, COUNT(*) FROM users WHERE position IS NOT NULL AND TRIM(position) != '' GROUP BY position ORDER BY position`
  );
  console.table(allPositions.rows);

  console.log('\n=== Departments and their head_doctor_id ===');
  const depts = await client.query(
    `SELECT d.id, d.name, d.head_doctor_id, u.username AS head_username, u.first_name, u.last_name
     FROM departments d
     LEFT JOIN users u ON u.id = d.head_doctor_id
     ORDER BY d.name`
  );
  console.table(depts.rows);

  await client.end();
  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
