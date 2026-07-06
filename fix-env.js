const fs = require('fs');
let env = fs.readFileSync('.env.local', 'utf8');
env = env.replace(/DATABASE_URL="([^"]+)"/, 'DATABASE_URL=$1');
fs.writeFileSync('.env.local', env);
console.log('Fixed .env.local');
