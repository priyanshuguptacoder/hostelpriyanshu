const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        code: 'AUTH_REQUIRED',
        message: 'Not authorized to access this route. Please login.'
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(401).json({
        success: false,
        code: error.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
        message: 'Invalid or expired token. Please login again.'
      });
    }

    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({
        success: false,
        code: 'USER_NOT_FOUND',
        message: 'User account was not found. Please login again.'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_DEACTIVATED',
        message: 'Your account has been deactivated. Please contact admin.'
      });
    }

    if ((user.role === 'student' || user.role === 'warden') && user.approvalStatus !== 'approved') {
      return res.status(403).json({
        success: false,
        code: user.approvalStatus === 'rejected' ? 'ACCOUNT_REJECTED' : 'ACCOUNT_PENDING',
        approvalStatus: user.approvalStatus,
        message: user.approvalStatus === 'rejected'
          ? (user.rejectionReason || 'Your account request was rejected.')
          : (user.role === 'warden'
            ? 'Your warden account is pending admin approval.'
            : 'Your student account is pending approval.')
      });
    }

    req.user = user;
    return next();
  } catch (error) {
    console.error('Authentication middleware error:', error);
    return res.status(500).json({
      success: false,
      code: 'AUTH_MIDDLEWARE_ERROR',
      message: 'Authentication service is temporarily unavailable.'
    });
  }
};

exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        code: 'ROLE_FORBIDDEN',
        message: `User role '${req.user.role}' is not authorized to access this route`
      });
    }
    next();
  };
};

exports.checkOwnership = (req, res, next) => {
  const requestedUserId = req.params.studentId || req.params.userId || req.body.studentId;

  if (req.user.role === 'warden' || req.user.role === 'admin') {
    return next();
  }

  if (req.user.role === 'student') {
    if (requestedUserId && requestedUserId !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        code: 'OWNERSHIP_FORBIDDEN',
        message: 'You are not authorized to access this data.'
      });
    }
  }

  next();
};

exports.validateAttendanceOwnership = (req, res, next) => {
  if (req.user.role === 'warden' || req.user.role === 'admin') {
    return next();
  }

  if (req.user.role === 'student') {
    if (req.body.studentId && req.body.studentId !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        code: 'ATTENDANCE_OWNERSHIP_FORBIDDEN',
        message: 'You can only mark your own attendance.'
      });
    }
    req.body.studentId = req.user._id.toString();
  }

  next();
};
