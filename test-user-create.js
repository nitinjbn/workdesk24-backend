const { User, sequelize } = require('./dist/models');

async function test() {
  try {
    // Enable query logging
    sequelize.options.logging = console.log;

    console.log('Testing User.create...');
    const user = await User.create({
      email: 'test' + Date.now() + '@example.com',
      password: 'Test123!',
      name: 'Test User'
    });

    console.log('User created:', user.toJSON());
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    console.error('SQL:', error.sql);
    process.exit(1);
  }
}

test();
