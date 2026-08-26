const express = require('express');
const router = express.Router();
const Complaint = require('../models/Complaint');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');

// @route   POST /api/complaints
// @desc    Create a new complaint (Student only)
// @access  Private (Student)
router.post('/', protect, authorize('student'), async (req, res) => {
  try {
    const { category, description, priority } = req.body;

    if (!category || !description) {
      return res.status(400).json({ 
        success: false, 
        message: 'Category and description are required' 
      });
    }

    // Generate unique ticket ID
    const ticketId = await Complaint.generateTicketId();

    // Create complaint
    const complaint = await Complaint.create({
      studentId: req.user._id,
      ticketId,
      category: category.toLowerCase(),
      description,
      priority: priority || 'medium',
      statusHistory: [{
        status: 'pending',
        changedBy: req.user._id,
        changedAt: new Date(),
        remarks: 'Complaint submitted'
      }]
    });

    await complaint.populate('studentId', 'name collegeId roomNumber hostelBlock');

    res.status(201).json({
      success: true,
      message: 'Complaint submitted successfully',
      complaint
    });
  } catch (error) {
    console.error('Create complaint error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error creating complaint',
      error: error.message 
    });
  }
});

// @route   GET /api/complaints/my
// @desc    Get my complaints (Student only)
// @access  Private (Student)
router.get('/my', protect, authorize('student'), async (req, res) => {
  try {
    const { status, category } = req.query;
    
    let query = { studentId: req.user._id };
    
    if (status) query.status = status;
    if (category) query.category = category.toLowerCase();

    const complaints = await Complaint.find(query)
      .sort({ createdAt: -1 })
      .populate('assignedTo', 'name role')
      .populate('resolvedBy', 'name role');

    // Calculate statistics
    const stats = {
      total: complaints.length,
      pending: complaints.filter(c => c.status === 'pending').length,
      inProgress: complaints.filter(c => c.status === 'in_progress').length,
      resolved: complaints.filter(c => c.status === 'resolved').length,
      rejected: complaints.filter(c => c.status === 'rejected').length
    };

    res.json({
      success: true,
      count: complaints.length,
      stats,
      complaints
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching complaints',
      error: error.message 
    });
  }
});

// @route   GET /api/complaints
// @desc    Get all complaints (Warden only)
// @access  Private (Warden)
router.get('/', protect, authorize('warden'), async (req, res) => {
  try {
    const { status, category, priority, studentId, startDate, endDate } = req.query;
    
    let query = {};
    
    if (status) query.status = status;
    if (category) query.category = category.toLowerCase();
    if (priority) query.priority = priority;
    if (studentId) query.studentId = studentId;
    
    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const complaints = await Complaint.find(query)
      .sort({ createdAt: -1 })
      .populate('studentId', 'name collegeId roomNumber hostelBlock')
      .populate('assignedTo', 'name role')
      .populate('resolvedBy', 'name role');

    // Calculate statistics
    const stats = {
      total: complaints.length,
      pending: complaints.filter(c => c.status === 'pending').length,
      inProgress: complaints.filter(c => c.status === 'in_progress').length,
      resolved: complaints.filter(c => c.status === 'resolved').length,
      rejected: complaints.filter(c => c.status === 'rejected').length,
      byCategory: {}
    };

    // Count by category
    complaints.forEach(c => {
      stats.byCategory[c.category] = (stats.byCategory[c.category] || 0) + 1;
    });

    res.json({
      success: true,
      count: complaints.length,
      stats,
      complaints
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching complaints',
      error: error.message 
    });
  }
});

// @route   GET /api/complaints/:id
// @desc    Get specific complaint details
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id)
      .populate('studentId', 'name collegeId roomNumber hostelBlock phoneNumber')
      .populate('assignedTo', 'name role')
      .populate('resolvedBy', 'name role')
      .populate('statusHistory.changedBy', 'name role');

    if (!complaint) {
      return res.status(404).json({ 
        success: false, 
        message: 'Complaint not found' 
      });
    }

    // Check ownership for students
    if (req.user.role === 'student') {
      const isOwner = complaint.studentId && complaint.studentId._id.toString() === req.user._id.toString();
      if (!isOwner) {
        return res.status(403).json({ 
          success: false, 
          message: 'Not authorized to view this complaint' 
        });
      }
    }

    res.json({
      success: true,
      complaint
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching complaint',
      error: error.message 
    });
  }
});

// @route   PUT /api/complaints/:id
// @desc    Update complaint status (Warden only)
// @access  Private (Warden)
router.put('/:id', protect, authorize('warden'), async (req, res) => {
  try {
    const { status, remarks, resolutionNotes, assignedTo, priority } = req.body;

    const complaint = await Complaint.findById(req.params.id);
    
    if (!complaint) {
      return res.status(404).json({ 
        success: false, 
        message: 'Complaint not found' 
      });
    }

    // Update status with history
    if (status && status !== complaint.status) {
      complaint.updateStatus(status, req.user._id, remarks);
    }

    // Update other fields
    if (remarks) complaint.remarks = remarks;
    if (resolutionNotes) complaint.resolutionNotes = resolutionNotes;
    if (assignedTo) complaint.assignedTo = assignedTo;
    if (priority) complaint.priority = priority;

    await complaint.save();
    await complaint.populate('studentId', 'name collegeId roomNumber');
    await complaint.populate('assignedTo', 'name role');

    res.json({
      success: true,
      message: 'Complaint updated successfully',
      complaint
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error updating complaint',
      error: error.message 
    });
  }
});

// @route   DELETE /api/complaints/:id
// @desc    Delete complaint (Warden only)
// @access  Private (Warden)
router.delete('/:id', protect, authorize('warden'), async (req, res) => {
  try {
    const complaint = await Complaint.findByIdAndDelete(req.params.id);
    
    if (!complaint) {
      return res.status(404).json({ 
        success: false, 
        message: 'Complaint not found' 
      });
    }

    res.json({
      success: true,
      message: 'Complaint deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error deleting complaint',
      error: error.message 
    });
  }
});

// @route   GET /api/complaints/analytics/summary
// @desc    Get complaint analytics (Warden only)
// @access  Private (Warden)
router.get('/analytics/summary', protect, authorize('warden'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let query = {};
    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const complaints = await Complaint.find(query);

    // Calculate average resolution time
    const resolvedComplaints = complaints.filter(c => c.status === 'resolved' && c.resolvedAt);
    const avgResolutionTime = resolvedComplaints.length > 0
      ? resolvedComplaints.reduce((sum, c) => {
          return sum + (c.resolvedAt - c.createdAt);
        }, 0) / resolvedComplaints.length
      : 0;

    // Category breakdown
    const categoryStats = {};
    complaints.forEach(c => {
      if (!categoryStats[c.category]) {
        categoryStats[c.category] = {
          total: 0,
          pending: 0,
          inProgress: 0,
          resolved: 0,
          rejected: 0
        };
      }
      categoryStats[c.category].total++;
      categoryStats[c.category][c.status.replace('_', '')]++;
    });

    const summary = {
      total: complaints.length,
      pending: complaints.filter(c => c.status === 'pending').length,
      inProgress: complaints.filter(c => c.status === 'in_progress').length,
      resolved: complaints.filter(c => c.status === 'resolved').length,
      rejected: complaints.filter(c => c.status === 'rejected').length,
      avgResolutionTimeHours: Math.round(avgResolutionTime / (1000 * 60 * 60)),
      categoryStats
    };

    res.json({
      success: true,
      summary
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching analytics',
      error: error.message 
    });
  }
});

module.exports = router;
