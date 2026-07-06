const postgres = require('postgres');

async function migrate() {
  const client = postgres(process.env.DATABASE_URL, { prepare: false });
  try {
    await client`ALTER TABLE operations ALTER COLUMN version TYPE bigint USING version::bigint;`;
    console.log('✅ Migration successful: version changed to bigint');
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
migrate();
