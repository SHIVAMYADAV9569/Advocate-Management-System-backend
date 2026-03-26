require('dotenv').config();
const { cloudinary } = require('./config/cloudinary');

console.log('🧪 Testing Cloudinary Connection\n');

// Test 1: Check environment variables
console.log('1. Checking environment variables...');
const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

console.log(`   Cloud Name: ${cloudName ? '✅ Set' : '❌ Missing'}`);
console.log(`   API Key: ${apiKey ? '✅ Set' : '❌ Missing'}`);
console.log(`   API Secret: ${apiSecret ? '✅ Set' : '❌ Missing'}`);

if (!cloudName || !apiKey || !apiSecret) {
  console.log('\n❌ Cloudinary credentials not set!');
  process.exit(1);
}

// Test 2: Test Cloudinary connection
console.log('\n2. Testing Cloudinary connection...');
cloudinary.api.ping((error, result) => {
  if (error) {
    console.log('   ❌ Connection failed:', error.message);
  } else {
    console.log('   ✅ Connection successful');
    console.log('\n🎉 Cloudinary is ready for document uploads!');
    console.log('📋 Documents will be stored in: advocate-system/documents/');
  }
});
