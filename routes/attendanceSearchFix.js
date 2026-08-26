const express = require('express');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/students', protect, authorize('warden'), async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();

    if (!search) {
      return res.status(400).json({ success: false, message: 'Search value is required.' });
    }

    const safe = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(safe, 'i');

    const students = await User.find({
      role: 'student',
      isActive: true,
      $or: [
        { collegeId: search.toUpperCase() },
        { email: search.toLowerCase() },
        { roomNumber: search },
        { name: regex }
      ]
    })
      .select('_id name collegeId email roomNumber hostelBlock department year')
      .sort({ name: 1 })
      .limit(20);

    return res.json({
      success: true,
      count: students.length,
      data: students
    });
  } catch (error) {
    console.error('Student search error:', error);
    return res.status(500).json({ success: false, message: 'Unable to search students.' });
  }
});

module.exports = router;
