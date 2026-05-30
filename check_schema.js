const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkSchema() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'workdesk24',
  });
  
  const [rows] = await conn.execute('DESCRIBE wd_users');
  console.log('wd_users table structure:');
  rows.forEach(row => console.log(`${row.Field} - ${row.Type}`));
  
  await conn.end();
}

checkSchema().catch(console.error);
