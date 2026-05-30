const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkDatabase() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'workdesk24'
  });

  console.log('✅ Connected to database\n');

  // Check tables
  const [tables] = await connection.query('SHOW TABLES');
  console.log('📊 Tables in database:');
  tables.forEach(table => {
    console.log(`  - ${Object.values(table)[0]}`);
  });
  console.log(`\nTotal: ${tables.length} tables\n`);

  // Check wd_users structure
  if (tables.some(t => Object.values(t)[0] === 'wd_users')) {
    const [columns] = await connection.query('DESCRIBE wd_users');
    console.log('🔍 wd_users structure:');
    columns.forEach(col => {
      console.log(`  ${col.Field}: ${col.Type}`);
    });
    console.log('');
  }

  // Check wd_attendance structure
  if (tables.some(t => Object.values(t)[0] === 'wd_attendance')) {
    const [columns] = await connection.query('DESCRIBE wd_attendance');
    console.log('🔍 wd_attendance structure:');
    columns.forEach(col => {
      console.log(`  ${col.Field}: ${col.Type}`);
    });
    console.log('');
  }

  // Check migrations run
  if (tables.some(t => Object.values(t)[0] === 'SequelizeMeta')) {
    const [migrations] = await connection.query('SELECT * FROM SequelizeMeta ORDER BY name');
    console.log('✅ Migrations run:');
    migrations.forEach(m => {
      console.log(`  - ${m.name}`);
    });
    console.log('');
  }

  await connection.end();
}

checkDatabase().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
