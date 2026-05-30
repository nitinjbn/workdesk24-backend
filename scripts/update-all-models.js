const fs = require('fs');
const path = require('path');

const modelsDir = path.join(__dirname, '../src/models');
const modelFiles = [
  'GpsHistory.ts',
  'Visit.ts',
  'Order.ts',
  'Payment.ts',
  'Feedback.ts',
  'Image.ts',
  'Inquiry.ts'
];

modelFiles.forEach(file => {
  const filePath = path.join(modelsDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Remove all snake_case field mappings for timestamp fields
  content = content.replace(/field: 'created_at',?\n\s*/g, '');
  content = content.replace(/field: 'updated_at',?\n\s*/g, '');
  content = content.replace(/field: 'synced_at',?\n\s*/g, '');
  content = content.replace(/field: 'deleted_at',?\n\s*/g, '');

  // Remove underscored: true from options
  content = content.replace(/underscored: true,?\n\s*/g, '');

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`✅ Updated ${file}`);
});

console.log('\n✅ All models updated!');
