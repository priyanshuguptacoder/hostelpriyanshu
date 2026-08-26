/**
 * Hostel Management System
 *
 * @author Priyanshu
 * @version 2.4
 */

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const passport = require('passport');

dotenv.config();

const app = express();
const indexPath = path.join(__dirname, 'public', 'index.html');

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || process.env.NODE_ENV !== 'production' || allowedOrigins.length === 0) {
      return callback(null, true);
    }
    return callback(null, allowedOrigins.includes(origin));
  },
  credentials: true
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.use(session({
  secret: process.env.JWT_SECRET || 'change-this-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

app.use(passport.initialize());
app.use(passport.session());

try {
  require('./config/passport')(passport);
  console.log('✅ Passport configured');
} catch (err) {
  console.log('⚠️ Passport config not found:', err.message);
}

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

// Authentication fixes are deliberately mounted before legacy handlers.
app.use('/api/auth', require('./routes/googleAuthFix'));
app.use('/api/auth', require('./routes/emailVerificationFix'));
app.use('/api/auth', require('./routes/authBehaviorFixes'));
app.use('/api/auth', require('./routes/authFixes'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/account', require('./routes/account'));

// Small focused route modules are mounted before broad feature routes.
app.use('/api/attendance', require('./routes/attendanceSearchFix'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/attendance-approval', require('./routes/attendanceApproval'));
app.use('/api/mess-bill', require('./routes/messBill'));
app.use('/api/mess-rate', require('./routes/messRate'));
app.use('/api/complaints', require('./routes/complaints'));
app.use('/api/announcements', require('./routes/announcements'));
app.use('/api/warden-requests', require('./routes/wardenRequests'));

app.get('/api/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const databaseReady = dbState === 1;
  const emailConfigured = Boolean(process.env.BREVO_API_KEY && process.env.BREVO_FROM_EMAIL);
  const googleConfigured = Boolean(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REDIRECT_URI
  );

  res.status(databaseReady ? 200 : 503).json({
    success: databaseReady,
    message: databaseReady ? 'Server running' : 'Database is not connected',
    services: {
      database: databaseReady,
      email: emailConfigured,
      googleOAuth: googleConfigured
    },
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/google-callback.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'google-callback.html'));
});

function sendIndex(req, res) {
  try {
    const html = fs.readFileSync(indexPath, 'utf8');
    res.type('html').send(html);
  } catch (error) {
    console.error('Failed to serve index:', error);
    res.status(500).send('Unable to load application');
  }
}

app.use(express.static(path.join(__dirname, 'public'), { index: false }));

app.get('/', sendIndex);
app.get('/index.html', sendIndex);

app.get('*', (req, res) => {
  if (req.path.match(/\.(html|css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
    return res.status(404).send('File not found');
  }
  sendIndex(req, res);
});

app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
