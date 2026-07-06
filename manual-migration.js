const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const { sql } = require('drizzle-orm');
require('dotenv').config({ path: '.env.local' });
async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('No DB URL');
  const client = postgres(connectionString);
  const db = drizzle(client);
  try {
    await db.execute(sql`ALTER TABLE operations ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE SET NULL;`);
    console.log('Successfully added user_id column to operations table.');
  } catch (err) {
    if (err.message.includes('already exists')) {
      console.log('Column already exists.');
    } else {
      console.error('Error:', err);
    }
  }
  process.exit(0);
}
main();
