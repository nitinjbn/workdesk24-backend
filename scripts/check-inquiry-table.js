const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkInquiryTable() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'workdesk24'
  });

  console.log('wd_inquiries table structure:\n');
  const [columns] = await connection.query('DESCRIBE wd_inquiries');
  columns.forEach(col => {
    const required = col.Null === 'NO' ? '[REQUIRED]' : '[optional]';
    const defaultVal = col.Default ? `(default: ${col.Default})` : '';
    console.log(`  ${col.Field.padEnd(15)} ${col.Type.padEnd(30)} ${required} ${defaultVal}`);
  });

  await connection.end();
}

checkInquiryTable().catch(err => console.error('Error:', err.message));
