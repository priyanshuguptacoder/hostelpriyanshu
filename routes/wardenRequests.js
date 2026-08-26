const express = require('express');
const router = express.Router();
const WardenRequest = require('../models/WardenRequest');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');

// @route   POST /api/warden-requests
// @desc    Submit warden access request
// @access  Private (Student)
router.post('/', protect, async (req, res) => {
    try {
        console.log('📝 POST /api/warden-requests called by:', req.user?.email, 'Role:', req.user?.role);
        
        // Check if user already has a pending request
        const existingRequest = await WardenRequest.findOne({
            userId: req.user._id,
            status: 'pending'
        });

        if (existingRequest) {
            console.log('⚠️ User already has a pending request');
            return res.status(400).json({
                success: false,
                message: 'You already have a pending warden request'
            });
        }

        // Check if user is already a warden
        if (req.user.role === 'warden') {
            console.log('⚠️ User is already a warden');
            return res.status(400).json({
                success: false,
                message: 'You already have warden access'
            });
        }

        const wardenRequest = await WardenRequest.create({
            userId: req.user._id,
            name: req.user.name,
            email: req.user.email,
            collegeId: req.user.collegeId,
            department: req.user.department,
            phoneNumber: req.user.phoneNumber
        });

        console.log('✅ Warden request created:', wardenRequest._id);

        res.status(201).json({
            success: true,
            message: 'Warden access request submitted successfully. Please wait for admin approval.',
            request: wardenRequest
        });
    } catch (error) {
        console.error('❌ Error in POST /api/warden-requests:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// @route   GET /api/warden-requests
// @desc    Get all warden requests (Admin only)
// @access  Private (Admin)
router.get('/', protect, authorize('admin'), async (req, res) => {
    try {
        console.log('📋 GET /api/warden-requests called by:', req.user?.email, 'Role:', req.user?.role);
        
        const { status } = req.query;
        const filter = status ? { status } : {};

        const requests = await WardenRequest.find(filter)
            .populate('userId', 'name email collegeId')
            .populate('reviewedBy', 'name')
            .sort({ requestedAt: -1 });

        console.log(`📊 Found ${requests.length} warden requests (filter: ${status || 'all'})`);

        const stats = {
            total: await WardenRequest.countDocuments(),
            pending: await WardenRequest.countDocuments({ status: 'pending' }),
            approved: await WardenRequest.countDocuments({ status: 'approved' }),
            rejected: await WardenRequest.countDocuments({ status: 'rejected' })
        };

        console.log('📊 Stats:', stats);

        res.json({
            success: true,
            requests,
            stats
        });
    } catch (error) {
        console.error('❌ Error in GET /api/warden-requests:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// @route   GET /api/warden-requests/my-request
// @desc    Get current user's warden request
// @access  Private
router.get('/my-request', protect, async (req, res) => {
    try {
        const request = await WardenRequest.findOne({ userId: req.user._id })
            .populate('reviewedBy', 'name')
            .sort({ requestedAt: -1 });

        res.json({
            success: true,
            request
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// @route   GET /api/warden-requests/:id
// @desc    Get specific warden request (Admin only)
// @access  Private (Admin)
router.get('/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const request = await WardenRequest.findById(req.params.id)
            .populate('userId', 'name email collegeId department phoneNumber roomNumber')
            .populate('reviewedBy', 'name');

        if (!request) {
            return res.status(404).json({
                success: false,
                message: 'Request not found'
            });
        }

        res.json({
            success: true,
            request
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// @route   PUT /api/warden-requests/:id/approve
// @desc    Approve warden request (Admin only)
// @access  Private (Admin)
router.put('/:id/approve', protect, authorize('admin'), async (req, res) => {
    try {
        // 1. Find the request by ID
        const request = await WardenRequest.findById(req.params.id);

        if (!request) {
            return res.status(404).json({
                success: false,
                message: 'Request not found'
            });
        }

        if (request.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: 'Request has already been reviewed'
            });
        }

        // 2. Set request.status = "approved"
        request.status = 'approved';
        request.reviewedBy = req.user._id;
        request.reviewedAt = Date.now();
        request.reviewNotes = req.body.notes || 'Approved by admin';

        // 3. Find the related user
        const user = await User.findById(request.userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // 4. Update user.role = "warden" and user.approvalStatus = "approved"
        user.role = 'warden';
        user.approvalStatus = 'approved';
        user.approvedBy = req.user._id;
        user.approvedAt = new Date();

        // 5. Save both
        await request.save();
        await user.save();

        res.json({
            success: true,
            message: 'Warden request approved successfully',
            request
        });
    } catch (error) {
        console.error('Error approving warden request:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// @route   PUT /api/warden-requests/:id/reject
// @desc    Reject warden request (Admin only)
// @access  Private (Admin)
router.put('/:id/reject', protect, authorize('admin'), async (req, res) => {
    try {
        // 1. Find the request by ID
        const request = await WardenRequest.findById(req.params.id);

        if (!request) {
            return res.status(404).json({
                success: false,
                message: 'Request not found'
            });
        }

        if (request.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: 'Request has already been reviewed'
            });
        }

        // 2. Set request.status = "rejected"
        request.status = 'rejected';
        request.reviewedBy = req.user._id;
        request.reviewedAt = Date.now();
        request.reviewNotes = req.body.notes || req.body.reason || 'Rejected by admin';

        // 3. Update user if needed
        const user = await User.findById(request.userId);

        if (user) {
            // If they are an approved student requesting warden access, they should remain an approved student.
            // If they are a pending manual signup warden, they should be marked as rejected.
            if (user.approvalStatus === 'pending') {
                user.approvalStatus = 'rejected';
                user.rejectionReason = req.body.notes || req.body.reason || 'Request rejected by admin';
                await user.save();
            }
        }

        // 4. Save request
        await request.save();

        res.json({
            success: true,
            message: 'Warden access request rejected.',
            request: {
                status: request.status,
                reviewNotes: request.reviewNotes,
                reviewedAt: request.reviewedAt,
                reviewedBy: request.reviewedBy
            },
            user: user ? {
                role: user.role,
                approvalStatus: user.approvalStatus
            } : null
        });
    } catch (error) {
        console.error('Error rejecting warden request:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;
