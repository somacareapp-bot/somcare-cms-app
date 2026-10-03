// fix-old-expense-statuses.js
// Updates any expense row whose status isn't one of the new enum values
// to 'dept_head_approved', so the Postgres enum migration can succeed.
//
// Reads DB connection info from backend/.env (same values your NestJS app
// uses). Run: node fix-old-expense-statuses.js

const fs = require('fs');
const { Client } = require('pg');

const ENV_PATH = '/Users/adminnopassword/Documents/Clinical MS/cms/backend/.env';
const NEW_STATUSES = ['pending', 'dept_head_approved', 'dept_head_rejected', 'approved', 'rejected', 'paid'];

function loadEnv(p) {
  const out = {};
  if (!fs.existsSync(p)) return out;
  const lines = fs.readFileSync(p, 'utf8').split('\n');
  for (const line of lines) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[m[1]] = val;
  }
  return out;
}

async function main() {
  const env = { ...loadEnv(ENV_PATH), ...process.env };

  const client = new Client({
    host: env.DB_HOST || env.POSTGRES_HOST || 'localhost',
    port: Number(env.DB_PORT || env.POSTGRES_PORT || 5432),
    user: env.DB_USERNAME || env.DB_USER || env.POSTGRES_USER || 'postgres',
    password: env.DB_PASSWORD || env.POSTGRES_PASSWORD || '',
    database: env.DB_NAME || env.DB_DATABASE || env.POSTGRES_DB || 'cms',
  });

  console.log(`Connecting to postgres://${client.user}@${client.host}:${client.port}/${client.database} ...`);
  await client.connect();

  const placeholders = NEW_STATUSES.map((_, i) => `$${i + 1}`).join(',');

  const before = await client.query(
    `SELECT status, COUNT(*) FROM expenses WHERE status::text NOT IN (${placeholders}) GROUP BY status`,
    NEW_STATUSES
  );
  console.log('Stray statuses found:', before.rows);

  if (before.rows.length === 0) {
    console.log('No stray statuses — the migration should already succeed.');
    console.log('If it still fails, this script may be pointed at a different');
    console.log('database than the one the backend actually connects to.');
  } else {
    const result = await client.query(
      `UPDATE expenses SET status = 'dept_head_approved' WHERE status::text NOT IN (${placeholders})`,
      NEW_STATUSES
    );
    console.log(`Updated ${result.rowCount} row(s) to 'dept_head_approved'.`);
  }

  await client.end();
  console.log('\nDone. Now restart the backend — the enum migration should succeed.');
}

main().catch((err) => {
  console.error('Failed:', err.message);
  console.error('\nIf connection details are wrong, edit the Client({...}) block at the top of this');
  console.error('script with your actual DB host/port/user/password/database, or run this SQL');
  console.error('directly via psql or your DB GUI instead:\n');
  console.error(
    "  UPDATE expenses SET status = 'dept_head_approved' WHERE status::text NOT IN " +
    "('pending','dept_head_approved','dept_head_rejected','approved','rejected','paid');"
  );
  process.exit(1);
});
