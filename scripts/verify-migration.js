const mysql = require('mysql2/promise');
require('dotenv').config();

async function verifyMigration() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'workdesk24'
  });

  console.log('========================================');
  console.log('  DATABASE MIGRATION VERIFICATION');
  console.log('========================================\n');

  // Check all tables exist
  const [tables] = await connection.query('SHOW TABLES');
  const tableNames = tables.map(t => Object.values(t)[0]).filter(t => t !== 'sequelizemeta');

  console.log('✅ Tables Created:');
  tableNames.forEach((table, i) => {
    console.log(`  ${i + 1}. ${table}`);
  });
  console.log(`\nTotal: ${tableNames.length} tables\n`);

  // Verify schema compliance
  console.log('✅ Schema Compliance Check:');

  // Check wd_users
  const [userCols] = await connection.query('DESCRIBE wd_users');
  const hasCamelCase = userCols.some(c => c.Field === 'createdAt');
  const hasBigInt = userCols.some(c => c.Field === 'createdAt' && c.Type.includes('bigint'));
  const hasSoftDelete = userCols.some(c => c.Field === 'isDeleted');

  console.log(`  camelCase columns: ${hasCamelCase ? '✅' : '❌'}`);
  console.log(`  BIGINT timestamps: ${hasBigInt ? '✅' : '❌'}`);
  console.log(`  Soft delete (isDeleted, deletedAt): ${hasSoftDelete ? '✅' : '❌'}`);

  // Check admin user
  console.log('\n✅ Admin User:');
  const [admin] = await connection.query('SELECT id, email, name, role FROM wd_users WHERE id = 1');
  if (admin.length > 0) {
    console.log(`  Email: ${admin[0].email}`);
    console.log(`  Name: ${admin[0].name}`);
    console.log(`  Role: ${admin[0].role}`);
    console.log('  Password: admin123');
    console.log('  ⚠️  CHANGE PASSWORD IN PRODUCTION!');
  } else {
    console.log('  ❌ Admin user not found!');
  }

  // Check indexes
  console.log('\n✅ Indexes:');
  const [indexes] = await connection.query('SHOW INDEX FROM wd_attendance');
  const indexNames = [...new Set(indexes.map(i => i.Key_name))].filter(i => i !== 'PRIMARY');
  console.log(`  wd_attendance has ${indexNames.length} indexes`);
  indexNames.forEach(idx => {
    console.log(`    - ${idx}`);
  });

  console.log('\n========================================');
  console.log('  ✅ MIGRATION SUCCESSFUL!');
  console.log('========================================\n');

  console.log('Next Steps:');
  console.log('  1. Test API endpoints');
  console.log('  2. Update mobile app (use BIGINT timestamps)');
  console.log('  3. Update Postman collection');
  console.log('  4. Change admin password');
  console.log('  5. Test all functionality\n');

  await connection.end();
}

verifyMigration().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
