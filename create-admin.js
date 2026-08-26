const mongoose = require('mongoose');
const dotenv = require('dotenv');
const ensurePrimaryAccounts = require('./utils/ensurePrimaryAccounts');

dotenv.config();

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hostel_management');
    console.log('✅ MongoDB connected');

    await ensurePrimaryAccounts();

    console.log('\n🎉 Primary accounts are ready.');
    console.log('Admin:   adminpriyanshu@hostel.com');
    console.log('Warden:  wardenpriyanshu@hostel.com');
    console.log('Student: studentpriyanshu@hostel.com');
    console.log('Password for all three: priyanshugupta');
    console.log('All three accounts are email-verified and approved.');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Primary account setup failed:', error);
    process.exit(1);
  }
})();
