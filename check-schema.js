const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkSchema() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  const [rows] = await connection.execute('DESCRIBE wd_users');
  console.log('Current wd_users table schema:');
  console.table(rows);

  await connection.end();
}

checkSchema().catch(console.error);
