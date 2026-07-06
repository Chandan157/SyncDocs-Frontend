const postgres = require('postgres');
require('dotenv').config({ path: '.env.local' });
async function run() {
  const sql = postgres(process.env.DATABASE_URL, { prepare: false });
  try {
    await sql`INSERT INTO users (id, email, password) VALUES ('01c38a12-0c19-48ca-9230-945a665d566b', 'test@test.com', 'dummy_hash') ON CONFLICT DO NOTHING`;
    console.log('User restored!');
  } catch(e) {
    console.error(e);
  }
  process.exit(0);
}
run();
