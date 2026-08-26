/**
 * Hostel Management System
 *
 * @author Priyanshu
 * @version 2.3
 */

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const session = require('express-session');
const passport = require('passport');

dotenv.config();

const app = express();

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.ALLOWED_ORIGINS?.split(',') || true
    : true,
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.JWT_SECRET || 'change-this-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

app.use(passport.initialize());
app.use(passport.session());

try {
  require('./config/passport')(passport);
  console.log('✅ Passport configured');
} catch (err) {
  console.log('⚠️ Passport config not found');
}

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

// Fixed authentication routes MUST be mounted before the legacy router.
app.use('/api/auth', require('./routes/authFixes'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/account', require('./routes/account'));

app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/attendance-approval', require('./routes/attendanceApproval'));
app.use('/api/mess-bill', require('./routes/messBill'));
app.use('/api/mess-rate', require('./routes/messRate'));
app.use('/api/complaints', require('./routes/complaints'));
app.use('/api/announcements', require('./routes/announcements'));
app.use('/api/warden-requests', require('./routes/wardenRequests'));

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Server running' });
});

app.get('/google-callback.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'google-callback.html'));
});

app.get('*', (req, res) => {
  if (req.path.match(/\.(html|css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
    return res.status(404).send('File not found');
  }

  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
