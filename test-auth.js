const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api/auth';

async function testAuth() {
  console.log('🧪 Testing Authentication APIs...\n');

  // Generate a random email for testing
  const testEmail = `test${Date.now()}@example.com`;
  const testPassword = 'TestPass123!';
  const testName = 'Test User';

  try {
    // Test Register
    console.log('1️⃣ Testing Register...');
    const registerRes = await axios.post(`${BASE_URL}/register`, {
      email: testEmail,
      password: testPassword,
      name: testName,
    });
    console.log('✅ Register Success:', {
      success: registerRes.data.success,
      message: registerRes.data.message,
      userId: registerRes.data.data?.user?.id,
      token: registerRes.data.data?.token ? 'Token received' : 'No token',
    });
    console.log('');

    // Test Login with correct password
    console.log('2️⃣ Testing Login with correct credentials...');
    const loginRes = await axios.post(`${BASE_URL}/login`, {
      email: testEmail,
      password: testPassword,
    });
    console.log('✅ Login Success:', {
      success: loginRes.data.success,
      message: loginRes.data.message,
      userId: loginRes.data.data?.user?.id,
      token: loginRes.data.data?.token ? 'Token received' : 'No token',
    });
    console.log('');

    // Test Login with wrong password
    console.log('3️⃣ Testing Login with wrong password...');
    try {
      await axios.post(`${BASE_URL}/login`, {
        email: testEmail,
        password: 'WrongPassword123!',
      });
      console.log('❌ FAILED: Should have rejected wrong password');
    } catch (error) {
      if (error.response) {
        console.log('✅ Correctly rejected:', error.response.data.message);
      } else {
        throw error;
      }
    }
    console.log('');

    // Test duplicate registration
    console.log('4️⃣ Testing duplicate registration...');
    try {
      await axios.post(`${BASE_URL}/register`, {
        email: testEmail,
        password: testPassword,
        name: testName,
      });
      console.log('❌ FAILED: Should have rejected duplicate email');
    } catch (error) {
      if (error.response) {
        console.log('✅ Correctly rejected:', error.response.data.message);
      } else {
        throw error;
      }
    }

    console.log('\n✅ All tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

testAuth();
