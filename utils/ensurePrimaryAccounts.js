const User = require('../models/User');

const PRIMARY_PASSWORD = 'priyanshugupta';

const PRIMARY_ACCOUNTS = [
  {
    email: 'adminpriyanshu@hostel.com',
    name: 'System Administrator',
    collegeId: 'ADMIN001',
    role: 'admin',
    approvalStatus: 'approved'
  },
  {
    email: 'priyanshuguptaiit99@gmail.com',
    name: 'Priyanshu Gupta',
    collegeId: 'ADMIN002',
    role: 'admin',
    approvalStatus: 'approved'
  },
  {
    email: 'wardenpriyanshu@hostel.com',
    name: 'Hostel Warden',
    collegeId: 'WARDEN001',
    role: 'warden',
    approvalStatus: 'approved'
  },
  {
    email: 'studentpriyanshu@hostel.com',
    name: 'Student',
    collegeId: 'CS2024001',
    role: 'student',
    approvalStatus: 'approved',
    roomNumber: '101',
    hostelBlock: 'A',
    department: 'Computer Science',
    year: 2
  }
];

async function ensurePrimaryAccounts() {
  for (const account of PRIMARY_ACCOUNTS) {
    const email = account.email.toLowerCase();
    let user = await User.findOne({ email });

    if (!user) {
      user = new User({
        ...account,
        email,
        password: PRIMARY_PASSWORD,
        emailVerified: true,
        isActive: true,
        phoneNumber: '9696625055'
      });
      await user.save();
      console.log(`[primary-accounts] Created ${account.role}: ${email}`);
      continue;
    }

    user.name = account.name;
    user.collegeId = account.collegeId;
    user.role = account.role;
    user.approvalStatus = account.approvalStatus;
    user.isActive = true;
    user.emailVerified = true;
    user.emailVerificationOTP = undefined;
    user.emailVerificationOTPExpires = undefined;
    user.password = PRIMARY_PASSWORD;

    if (account.roomNumber !== undefined) user.roomNumber = account.roomNumber;
    if (account.hostelBlock !== undefined) user.hostelBlock = account.hostelBlock;
    if (account.department !== undefined) user.department = account.department;
    if (account.year !== undefined) user.year = account.year;

    await user.save();
    console.log(`[primary-accounts] Updated ${account.role}: ${email}`);
  }
}

module.exports = ensurePrimaryAccounts;
