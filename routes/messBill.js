const express = require('express');
const router = express.Router();
const MessBill = require('../models/MessBill');
const MessRate = require('../models/MessRate');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const { protect, authorize, checkOwnership } = require('../middleware/auth');

// @route   POST /api/mess-bill/generate
// @desc    Generate mess bill for a student (Warden only)
// @access  Private (Warden)
router.post('/generate', protect, authorize('warden'), async (req, res) => {
  try {
    const { studentId, month, year } = req.body;

    if (!studentId || !month || !year) {
      return res.status(400).json({ 
        success: false, 
        message: 'Student ID, month, and year are required' 
      });
    }

    // Verify student exists
    const student = await User.findById(studentId);
    if (!student || student.role !== 'student') {
      return res.status(404).json({ 
        success: false, 
        message: 'Student not found' 
      });
    }

    // Check if bill already exists
    const existingBill = await MessBill.findOne({ studentId, month, year });
    if (existingBill) {
      return res.status(400).json({ 
        success: false, 
        message: 'Bill already exists for this month. Use update endpoint to modify.',
        bill: existingBill
      });
    }

    // Get mess rate for the month
    const messRate = await MessRate.getCurrentRate(month, year);
    const dailyRate = messRate.dailyRate || 100;

    // Calculate attendance days for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const attendanceRecords = await Attendance.find({
      studentId,
      date: { $gte: startDate, $lte: endDate },
      status: 'present' // Only count present days
    });

    const totalDays = attendanceRecords.length;
    const totalAmount = totalDays * dailyRate;

    // Create bill
    const bill = await MessBill.create({
      studentId,
      month,
      year,
      totalDays,
      rate: dailyRate,
      totalAmount,
      generatedBy: req.user._id
    });

    await bill.populate('studentId', 'name collegeId roomNumber');

    res.status(201).json({
      success: true,
      message: 'Mess bill generated successfully',
      bill
    });
  } catch (error) {
    console.error('Generate bill error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error generating bill',
      error: error.message 
    });
  }
});

// @route   POST /api/mess-bill/generate-all
// @desc    Generate bills for all students (Warden only)
// @access  Private (Warden)
router.post('/generate-all', protect, authorize('warden'), async (req, res) => {
  try {
    const { month, year } = req.body;

    if (!month || !year) {
      return res.status(400).json({ 
        success: false, 
        message: 'Month and year are required' 
      });
    }

    // Get all active students
    const students = await User.find({ role: 'student', isActive: true });

    // Get mess rate
    const messRate = await MessRate.getCurrentRate(month, year);
    const dailyRate = messRate.dailyRate || 100;

    // Calculate date range
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const results = {
      success: [],
      failed: [],
      skipped: []
    };

    for (const student of students) {
      try {
        // Check if bill already exists
        const existingBill = await MessBill.findOne({ 
          studentId: student._id, 
          month, 
          year 
        });

        if (existingBill) {
          results.skipped.push({
            studentId: student._id,
            name: student.name,
            reason: 'Bill already exists'
          });
          continue;
        }

        // Get attendance
        const attendanceRecords = await Attendance.find({
          studentId: student._id,
          date: { $gte: startDate, $lte: endDate },
          status: 'present'
        });

        const totalDays = attendanceRecords.length;
        const totalAmount = totalDays * dailyRate;

        // Create bill
        await MessBill.create({
          studentId: student._id,
          month,
          year,
          totalDays,
          rate: dailyRate,
          totalAmount,
          generatedBy: req.user._id
        });

        results.success.push({
          studentId: student._id,
          name: student.name,
          totalDays,
          totalAmount
        });
      } catch (error) {
        results.failed.push({
          studentId: student._id,
          name: student.name,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      message: 'Bulk bill generation completed',
      summary: {
        total: students.length,
        generated: results.success.length,
        failed: results.failed.length,
        skipped: results.skipped.length
      },
      results
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error generating bills',
      error: error.message 
    });
  }
});

// @route   GET /api/mess-bill/all
// @desc    Get all mess bills with filters (Warden/Admin only)
// @access  Private (Warden/Admin)
router.get('/all', protect, authorize('warden', 'admin'), async (req, res) => {
  try {
    const { month, year, paymentStatus, studentId } = req.query;
    
    const filter = {};
    if (month) filter.month = parseInt(month);
    if (year) filter.year = parseInt(year);
    if (paymentStatus) filter.paymentStatus = paymentStatus;
    if (studentId) filter.studentId = studentId;

    const bills = await MessBill.find(filter)
      .populate('studentId', 'name collegeId roomNumber hostelBlock')
      .populate('generatedBy', 'name')
      .sort({ year: -1, month: -1, createdAt: -1 });

    const stats = {
      total: bills.length,
      totalAmount: bills.reduce((sum, bill) => sum + bill.totalAmount, 0),
      paidAmount: bills.reduce((sum, bill) => sum + (bill.paidAmount || 0), 0),
      pendingAmount: bills.reduce((sum, bill) => {
        return sum + (bill.paymentStatus !== 'paid' ? bill.totalAmount - (bill.paidAmount || 0) : 0);
      }, 0),
      paid: bills.filter(b => b.paymentStatus === 'paid').length,
      pending: bills.filter(b => b.paymentStatus === 'pending').length,
      partial: bills.filter(b => b.paymentStatus === 'partial').length
    };

    res.json({
      success: true,
      count: bills.length,
      stats,
      bills
    });
  } catch (error) {
    console.error('Error fetching all bills:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching bills',
      error: error.message 
    });
  }
});

// @route   GET /api/mess-bill/my
// @desc    Get my mess bills (Student only)
// @access  Private (Student)
router.get('/my', protect, authorize('student'), async (req, res) => {
  try {
    const bills = await MessBill.find({ studentId: req.user._id })
      .sort({ year: -1, month: -1 });

    res.json({
      success: true,
      count: bills.length,
      bills
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching bills',
      error: error.message 
    });
  }
});

// @route   GET /api/mess-bill/student/:studentId
// @desc    Get bills for specific student (Warden only)
// @access  Private (Warden)
router.get('/student/:studentId', protect, authorize('warden'), async (req, res) => {
  try {
    const bills = await MessBill.find({ studentId: req.params.studentId })
      .sort({ year: -1, month: -1 })
      .populate('studentId', 'name collegeId roomNumber');

    res.json({
      success: true,
      count: bills.length,
      bills
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching bills',
      error: error.message 
    });
  }
});

// @route   GET /api/mess-bill/:id
// @desc    Get specific bill details
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const bill = await MessBill.findById(req.params.id)
      .populate('studentId', 'name collegeId roomNumber hostelBlock')
      .populate('generatedBy', 'name role');

    if (!bill) {
      return res.status(404).json({ 
        success: false, 
        message: 'Bill not found' 
      });
    }

    // Check ownership for students
    if (req.user.role === 'student') {
      const isOwner = bill.studentId && bill.studentId._id.toString() === req.user._id.toString();
      if (!isOwner) {
        return res.status(403).json({ 
          success: false, 
          message: 'Not authorized to view this bill' 
        });
      }
    }

    res.json({
      success: true,
      bill
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching bill',
      error: error.message 
    });
  }
});

// @route   PUT /api/mess-bill/:id
// @desc    Update mess bill (Warden only)
// @access  Private (Warden)
router.put('/:id', protect, authorize('warden'), async (req, res) => {
  try {
    const { rate, extraCharges, deductions, paymentStatus, paidAmount } = req.body;

    const bill = await MessBill.findById(req.params.id);
    
    if (!bill) {
      return res.status(404).json({ 
        success: false, 
        message: 'Bill not found' 
      });
    }

    // Update fields
    if (rate !== undefined) bill.rate = rate;
    if (extraCharges !== undefined) bill.extraCharges = extraCharges;
    if (deductions !== undefined) bill.deductions = deductions;
    if (paymentStatus) bill.paymentStatus = paymentStatus;
    if (paidAmount !== undefined) bill.paidAmount = paidAmount;
    
    if (paymentStatus === 'paid') {
      bill.paidDate = new Date();
    }

    // Recalculate total
    bill.calculateTotal();
    await bill.save();

    res.json({
      success: true,
      message: 'Bill updated successfully',
      bill
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error updating bill',
      error: error.message 
    });
  }
});

// @route   PUT /api/mess-bill/:id/pay
// @desc    Mark bill as paid (Warden only)
// @access  Private (Warden)
router.put('/:id/pay', protect, authorize('warden'), async (req, res) => {
  try {
    const { paymentStatus, paidAmount } = req.body;

    const bill = await MessBill.findById(req.params.id);
    
    if (!bill) {
      return res.status(404).json({ 
        success: false, 
        message: 'Bill not found' 
      });
    }

    // Update payment status
    bill.paymentStatus = paymentStatus || 'paid';
    bill.paidAmount = paidAmount !== undefined ? paidAmount : bill.totalAmount;
    
    if (bill.paymentStatus === 'paid') {
      bill.paidDate = new Date();
    }

    await bill.save();

    res.json({
      success: true,
      message: 'Bill payment status updated successfully',
      bill
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error updating payment status',
      error: error.message 
    });
  }
});

// @route   PUT /api/mess-bill/:id/recalculate
// @desc    Recalculate bill based on current attendance (Warden only)
// @access  Private (Warden)
router.put('/:id/recalculate', protect, authorize('warden'), async (req, res) => {
  try {
    const bill = await MessBill.findById(req.params.id);
    
    if (!bill) {
      return res.status(404).json({ 
        success: false, 
        message: 'Bill not found' 
      });
    }

    // Get attendance for the month
    const startDate = new Date(bill.year, bill.month - 1, 1);
    const endDate = new Date(bill.year, bill.month, 0);

    const attendanceRecords = await Attendance.find({
      studentId: bill.studentId,
      date: { $gte: startDate, $lte: endDate },
      status: 'present'
    });

    // Update bill
    bill.totalDays = attendanceRecords.length;
    bill.calculateTotal();
    await bill.save();

    res.json({
      success: true,
      message: 'Bill recalculated successfully',
      bill
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error recalculating bill',
      error: error.message 
    });
  }
});

// @route   GET /api/mess-bill/summary/:month/:year
// @desc    Get billing summary for a month (Warden only)
// @access  Private (Warden)
router.get('/summary/:month/:year', protect, authorize('warden'), async (req, res) => {
  try {
    const { month, year } = req.params;

    const bills = await MessBill.find({ 
      month: parseInt(month), 
      year: parseInt(year) 
    }).populate('studentId', 'name collegeId roomNumber');

    const summary = {
      totalBills: bills.length,
      totalAmount: bills.reduce((sum, bill) => sum + bill.totalAmount, 0),
      paidAmount: bills.reduce((sum, bill) => sum + (bill.paidAmount || 0), 0),
      pendingAmount: bills.reduce((sum, bill) => {
        return sum + (bill.paymentStatus !== 'paid' ? bill.totalAmount - (bill.paidAmount || 0) : 0);
      }, 0),
      paidCount: bills.filter(b => b.paymentStatus === 'paid').length,
      pendingCount: bills.filter(b => b.paymentStatus === 'pending').length,
      partialCount: bills.filter(b => b.paymentStatus === 'partial').length
    };

    res.json({
      success: true,
      month: parseInt(month),
      year: parseInt(year),
      summary,
      bills
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching summary',
      error: error.message 
    });
  }
});

// @route   DELETE /api/mess-bill/:id
// @desc    Delete mess bill (Warden only)
// @access  Private (Warden)
router.delete('/:id', protect, authorize('warden'), async (req, res) => {
  try {
    const bill = await MessBill.findByIdAndDelete(req.params.id);
    
    if (!bill) {
      return res.status(404).json({ 
        success: false, 
        message: 'Bill not found' 
      });
    }

    res.json({
      success: true,
      message: 'Bill deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error deleting bill',
      error: error.message 
    });
  }
});

module.exports = router;
