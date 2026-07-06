require('dotenv').config({ path: '.env.local' });
const { execSync } = require('child_process');
try {
  execSync('npx drizzle-kit push', { stdio: 'inherit' });
} catch (e) {
  console.error(e);
}
