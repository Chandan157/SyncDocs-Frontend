const postgres = require('postgres');
async function run() {
  const sql = postgres(process.env.DATABASE_URL, { prepare: false });
  try {
    await sql`DROP TABLE IF EXISTS operations CASCADE`;
    await sql`DROP TABLE IF EXISTS activity CASCADE`;
    await sql`DROP TABLE IF EXISTS versions CASCADE`;
    await sql`DROP TABLE IF EXISTS document_members CASCADE`;
    await sql`DROP TABLE IF EXISTS documents CASCADE`;
    await sql`DROP TABLE IF EXISTS users CASCADE`;
    await sql`DROP TYPE IF EXISTS role CASCADE`;
    await sql`DROP TYPE IF EXISTS status CASCADE`;
    console.log('Tables dropped successfully.');
  } catch(e) {
    console.error(e);
  }
  process.exit(0);
}
run();
