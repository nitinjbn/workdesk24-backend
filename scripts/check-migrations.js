const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkMigrations() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'workdesk24'
  });

  const [migrations] = await connection.query('SELECT * FROM SequelizeMeta ORDER BY name');

  console.log('✅ Migrations already run:');
  migrations.forEach(m => {
    console.log(`  ${m.name}`);
  });
  console.log(`\nTotal: ${migrations.length} migrations\n`);

  await connection.end();
}

checkMigrations().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
