const postgres = require('postgres');
async function verify() {
  const client = postgres(process.env.DATABASE_URL, { prepare: false });
  try {
    const docs = await client`SELECT id, title, created_at FROM documents ORDER BY created_at DESC LIMIT 3;`;
    console.log('--- RECENT DOCUMENTS ---');
    console.log(docs);
    const ops = await client`SELECT id, document_id, version, timestamp FROM operations ORDER BY timestamp DESC LIMIT 3;`;
    console.log('\n--- RECENT OPERATIONS ---');
    console.log(ops);
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
verify();
