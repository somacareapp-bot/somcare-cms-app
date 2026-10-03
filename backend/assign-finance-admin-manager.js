// assign-finance-admin-manager.js
// Sets Abdifattah Mohamoud (position: "Finance & Admin Manager") as
// head_doctor_id on the Finance & Accounts and Reception & Registration
// departments, which currently have no head assigned.
//
// IMPORTANT: make sure you clicked "Add Staff" to actually save him before
// running this — the script looks him up by name + position.
//
// Run from the backend folder: node assign-finance-admin-manager.js

const fs = require('fs');
const { Client } = require('pg');

const ENV_PATH = '/Users/adminnopassword/Documents/Clinical MS/cms/backend/.env';
const TARGET_DEPARTMENTS = ['Finance & Accounts', 'Reception & Registration'];

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

  const userResult = await client.query(
    `SELECT id, username, first_name, last_name, position, status
     FROM users
     WHERE first_name = 'Abdifattah' AND last_name = 'Mohamoud'`
  );

  if (userResult.rows.length === 0) {
    console.error('Could not find a user named Abdifattah Mohamoud.');
    console.error('Did you click "Add Staff" to actually save him? The modal was still open in the screenshot.');
    await client.end();
    process.exit(1);
  }
  if (userResult.rows.length > 1) {
    console.error('Found more than one user named Abdifattah Mohamoud — refusing to guess which one:');
    console.table(userResult.rows);
    await client.end();
    process.exit(1);
  }

  const manager = userResult.rows[0];
  console.log('Found staff member:');
  console.table([manager]);

  if (manager.status !== 'active') {
    console.error(`This user's status is "${manager.status}", not "active" — fix that first, then re-run.`);
    await client.end();
    process.exit(1);
  }

  for (const deptName of TARGET_DEPARTMENTS) {
    const before = await client.query(`SELECT id, name, head_doctor_id FROM departments WHERE name = $1`, [deptName]);
    if (before.rows.length === 0) {
      console.warn(`Department "${deptName}" not found — skipping.`);
      continue;
    }
    if (before.rows[0].head_doctor_id) {
      console.log(`"${deptName}" already has a head (${before.rows[0].head_doctor_id}) — skipping, not overwriting.`);
      continue;
    }
    await client.query(`UPDATE departments SET head_doctor_id = $1 WHERE name = $2`, [manager.id, deptName]);
    console.log(`Set "${deptName}" head_doctor_id to ${manager.id} (${manager.first_name} ${manager.last_name}).`);
  }

  await client.end();
  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
