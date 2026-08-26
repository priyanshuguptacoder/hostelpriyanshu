/**
 * Hostel Management System - Dashboard Module
 * 
 * @author Priyanshu
 * @copyright 2026 Priyanshu. All Rights Reserved.
 */

async function loadDashboard() {
    console.log('loadDashboard called, currentUser:', window.currentUser || currentUser); // Debug log
    
    const user = window.currentUser || currentUser;
    if (!user) {
        console.error('No user found in loadDashboard!');
        return;
    }
    
    const role = user.role;
    const sidebar = document.getElementById('sidebar-menu');
    
    const menus = {
        student: [
            { name: '📊 Dashboard', view: 'studentDashboard' },
            { name: '📅 Mark Attendance', view: 'markMyAttendance' },
            { name: '📋 My Attendance', view: 'myAttendance' },
            { name: '💰 My Bills', view: 'myBills' },
            { name: '🔧 My Complaints', view: 'myComplaints' },
            { name: '📢 Announcements', view: 'announcements' },
            { name: '🎓 Request Warden Access', view: 'wardenRequest' }
        ],
        warden: [
            { name: '📊 Dashboard', view: 'wardenDashboard' },
            { name: '✅ Mark Attendance', view: 'markAttendance' },
            { name: '📅 Attendance Records', view: 'attendanceRecords' },
            { name: '💰 Mess Bills', view: 'messBills' },
            { name: '🔧 Complaints', view: 'complaints' },
            { name: '📢 Announcements', view: 'manageAnnouncements' }
        ],
        admin: [
            { name: '📊 Admin Dashboard', view: 'adminDashboard' },
            { name: '👥 Pending Wardens', view: 'pendingWardens', badge: true },
            { name: '👤 All Users', view: 'allUsers' },
            { name: '📢 Announcements', view: 'manageAnnouncements' }
        ]
    };

    sidebar.innerHTML = '';
    
    // Fetch pending warden count for admin
    let pendingWardenCount = 0;
    if (role === 'admin') {
        try {
            const wardenStats = await apiCall('/warden-requests');
            pendingWardenCount = wardenStats.stats.pending || 0;
        } catch (error) {
            console.log('Could not fetch warden stats:', error);
        }
    }
    
    menus[role].forEach((menu, index) => {
        const li = document.createElement('li');
        li.textContent = menu.name;
        
        // Add badge for pending wardens
        if (menu.badge && pendingWardenCount > 0) {
            const badge = document.createElement('span');
            badge.className = 'notification-badge';
            badge.textContent = pendingWardenCount;
            badge.style.cssText = 'background: var(--danger); color: white; border-radius: 50%; padding: 2px 8px; font-size: 12px; margin-left: 8px; font-weight: 700;';
            li.appendChild(badge);
        }
        
        li.onclick = () => {
            navigateTo(menu.view);
        };
        li.dataset.view = menu.view;
        sidebar.appendChild(li);
    });

    navigateTo(menus[role][0].view);
}

// loadView is now centralized in app.js

// ==================== STUDENT VIEWS ====================

async function renderStudentDashboard() {
    try {
        showLoading();
        const today = new Date();
        const month = today.getMonth() + 1;
        const year = today.getFullYear();

        // Fetch data in parallel
        const [attendanceResult, billsResult, complaintsResult] = await Promise.all([
            apiCall(`/attendance/my?month=${month}&year=${year}`),
            apiCall('/mess-bill/my'),
            apiCall('/complaints/my')
        ]);

        const currentBill = billsResult.bills.find(b => b.month === month && b.year === year);
        const activeComplaints = complaintsResult.complaints.filter(c => c.status !== 'resolved');
        
        const user = window.currentUser || currentUser;
        
        // Calculate attendance percentage
        const totalDays = attendanceResult.stats.present + attendanceResult.stats.absent;
        const attendancePercentage = totalDays > 0 ? Math.round((attendanceResult.stats.present / totalDays) * 100) : 0;

        const html = `
            <div class="page-header">
                <h2>Welcome back, ${user.name}! 👋</h2>
                <p>Here's your hostel dashboard overview for ${getMonthName(month)} ${year}</p>
            </div>
            
            <!-- Quick Actions -->
            <div class="quick-actions">
                <div class="quick-action-card" onclick="loadView('markMyAttendance')">
                    <div class="icon">📅</div>
                    <h4>Mark Attendance</h4>
                </div>
                <div class="quick-action-card" onclick="loadView('myBills')">
                    <div class="icon">💰</div>
                    <h4>View Bills</h4>
                </div>
                <div class="quick-action-card" onclick="loadView('myComplaints')">
                    <div class="icon">🔧</div>
                    <h4>Submit Complaint</h4>
                </div>
                <div class="quick-action-card" onclick="loadView('announcements')">
                    <div class="icon">📢</div>
                    <h4>Announcements</h4>
                </div>
            </div>
            
            <!-- Stats Grid -->
            <div class="stats-grid">
                <div class="stat-card hover-lift">
                    <h4>Present Days</h4>
                    <div class="stat-value">${attendanceResult.stats.present}</div>
                    <div class="stat-label">This month</div>
                </div>
                <div class="stat-card hover-lift">
                    <h4>Absent Days</h4>
                    <div class="stat-value">${attendanceResult.stats.absent}</div>
                    <div class="stat-label">This month</div>
                </div>
                <div class="stat-card hover-lift">
                    <h4>Room Number</h4>
                    <div class="stat-value">${user.roomNumber || 'N/A'}</div>
                    <div class="stat-label">Block ${user.hostelBlock || 'N/A'}</div>
                </div>
                <div class="stat-card hover-lift">
                    <h4>Current Bill</h4>
                    <div class="stat-value">₹${currentBill ? currentBill.totalAmount : 0}</div>
                    <div class="stat-label">${currentBill ? currentBill.paymentStatus : 'Not generated'}</div>
                </div>
            </div>

            <!-- Attendance Progress -->
            <div class="card">
                <h3>📊 Attendance Overview</h3>
                ${createProgressChart(attendancePercentage, 'Attendance Rate')}
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px; margin-top: 20px;">
                    <div style="text-align: center; padding: 16px; background: var(--light-gray); border-radius: var(--radius);">
                        <div style="font-size: 28px; font-weight: 700; color: var(--success);">${attendanceResult.stats.present}</div>
                        <div style="font-size: 13px; color: var(--text-secondary); margin-top: 4px;">Present</div>
                    </div>
                    <div style="text-align: center; padding: 16px; background: var(--light-gray); border-radius: var(--radius);">
                        <div style="font-size: 28px; font-weight: 700; color: var(--danger);">${attendanceResult.stats.absent}</div>
                        <div style="font-size: 13px; color: var(--text-secondary); margin-top: 4px;">Absent</div>
                    </div>
                    <div style="text-align: center; padding: 16px; background: var(--light-gray); border-radius: var(--radius);">
                        <div style="font-size: 28px; font-weight: 700; color: var(--warning);">${attendanceResult.stats.late || 0}</div>
                        <div style="font-size: 13px; color: var(--text-secondary); margin-top: 4px;">Late</div>
                    </div>
                    <div style="text-align: center; padding: 16px; background: var(--light-gray); border-radius: var(--radius);">
                        <div style="font-size: 28px; font-weight: 700; color: var(--info);">${attendanceResult.stats.leave || 0}</div>
                        <div style="font-size: 13px; color: var(--text-secondary); margin-top: 4px;">Leave</div>
                    </div>
                </div>
            </div>

            <!-- Active Complaints -->
            <div class="card">
                <div class="flex-between mb-3">
                    <h3>🔧 Active Complaints</h3>
                    <button class="btn btn-sm" onclick="loadView('myComplaints')">View All</button>
                </div>
                ${activeComplaints.length > 0 ? `
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Ticket ID</th>
                                    <th>Category</th>
                                    <th>Priority</th>
                                    <th>Status</th>
                                    <th>Date</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${activeComplaints.slice(0, 5).map(c => `
                                    <tr>
                                        <td><strong>${c.ticketId}</strong></td>
                                        <td><span class="badge badge-info">${c.category}</span></td>
                                        <td><span class="badge badge-warning">${c.priority}</span></td>
                                        <td><span class="badge badge-${c.status === 'resolved' ? 'success' : c.status === 'in_progress' ? 'warning' : 'danger'}">${c.status.replace('_', ' ')}</span></td>
                                        <td>${formatDate(c.createdAt)}</td>
                                        <td><button class="btn btn-sm" onclick="viewComplaintDetails('${c._id}')">View</button></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : '<div class="empty-state"><p>No active complaints. Everything is running smoothly! 🎉</p></div>'}
            </div>

            <!-- Recent Bills -->
            ${currentBill ? `
                <div class="card">
                    <h3>💰 Current Month Bill</h3>
                    <div style="background: var(--light-gray); padding: 24px; border-radius: var(--radius); margin-top: 16px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                            <div>
                                <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 4px;">Total Amount</div>
                                <div style="font-size: 36px; font-weight: 800; color: var(--primary);">₹${currentBill.totalAmount}</div>
                            </div>
                            <span class="badge badge-${currentBill.paymentStatus === 'paid' ? 'success' : 'warning'}" style="font-size: 14px; padding: 8px 16px;">
                                ${currentBill.paymentStatus}
                            </span>
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-top: 16px;">
                            <div>
                                <div style="font-size: 13px; color: var(--text-secondary);">Days Present</div>
                                <div style="font-size: 20px; font-weight: 700;">${currentBill.totalDays}</div>
                            </div>
                            <div>
                                <div style="font-size: 13px; color: var(--text-secondary);">Rate per Day</div>
                                <div style="font-size: 20px; font-weight: 700;">₹${currentBill.rate}</div>
                            </div>
                        </div>
                        <button class="btn mt-3" onclick="viewBillDetails('${currentBill._id}')" style="width: 100%;">View Full Details</button>
                    </div>
                </div>
            ` : ''}
        `;
        
        document.getElementById('content-area').innerHTML = html;
        hideLoading();
    } catch (error) {
        hideLoading();
        showAlert(error.message, 'error');
    }
}

function renderMarkMyAttendance() {
    const html = `
        <div class="page-header">
            <h2>📅 Mark Today's Attendance</h2>
            <p>Mark your attendance for ${formatDate(new Date())}</p>
        </div>
        
        <div class="card">
            <h3>Attendance Marking</h3>
            <form onsubmit="submitMyAttendance(event)">
                <div class="form-group">
                    <label>Status</label>
                    <select id="attendance-status" required>
                        <option value="present">✅ Present</option>
                        <option value="absent">❌ Absent</option>
                        <option value="late">⏰ Late Entry</option>
                        <option value="leave">🏖️ On Leave</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Remarks (Optional)</label>
                    <input type="text" id="attendance-remarks" placeholder="Any additional notes...">
                </div>
                <button type="submit" class="btn">Mark Attendance</button>
            </form>
        </div>

        <div class="card">
            <h3>ℹ️ Important Notes</h3>
            <ul style="padding-left: 20px; line-height: 2;">
                <li>You can mark attendance only once per day</li>
                <li>Attendance cannot be edited after marking</li>
                <li>Your mess bill will be calculated based on present days</li>
                <li>Contact warden if you need to correct attendance</li>
            </ul>
        </div>
    `;
    
    document.getElementById('content-area').innerHTML = html;
}

async function submitMyAttendance(event) {
    event.preventDefault();
    
    const data = {
        status: document.getElementById('attendance-status').value,
        remarks: document.getElementById('attendance-remarks').value
    };

    try {
        const result = await apiCall('/attendance/mark', 'POST', data);
        showAlert('Attendance marked successfully!', 'success');
        setTimeout(() => loadView('myAttendance'), 1000);
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

async function renderMyAttendance() {
    try {
        const today = new Date();
        const month = today.getMonth() + 1;
        const year = today.getFullYear();
        
        const result = await apiCall(`/attendance/my?month=${month}&year=${year}`);
        
        const html = `
            <div class="page-header">
                <h2>📋 My Attendance Records</h2>
                <p>${today.toLocaleString('default', { month: 'long', year: 'numeric' })}</p>
            </div>

            <div class="stats-grid">
                <div class="stat-card">
                    <h4>Present</h4>
                    <div class="stat-value" style="color: var(--success)">${result.stats.present}</div>
                </div>
                <div class="stat-card">
                    <h4>Absent</h4>
                    <div class="stat-value" style="color: var(--danger)">${result.stats.absent}</div>
                </div>
                <div class="stat-card">
                    <h4>Late</h4>
                    <div class="stat-value" style="color: var(--warning)">${result.stats.late}</div>
                </div>
                <div class="stat-card">
                    <h4>Leave</h4>
                    <div class="stat-value" style="color: var(--info)">${result.stats.leave}</div>
                </div>
            </div>
            
            <div class="card">
                <h3>Attendance Records</h3>
                ${result.attendance.length > 0 ? `
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Status</th>
                                    <th>Marked At</th>
                                    <th>Remarks</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${result.attendance.map(a => `
                                    <tr>
                                        <td>${formatDate(a.date)}</td>
                                        <td><span class="badge badge-${a.status === 'present' ? 'success' : a.status === 'absent' ? 'danger' : 'warning'}">${a.status}</span></td>
                                        <td>${formatDateTime(a.markedAt)}</td>
                                        <td>${a.remarks || '-'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : '<div class="empty-state"><p>No attendance records for this month</p></div>'}
            </div>
        `;
        
        document.getElementById('content-area').innerHTML = html;
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

async function renderMyBills() {
    try {
        const result = await apiCall('/mess-bill/my');
        
        const html = `
            <div class="page-header">
                <h2>💰 My Mess Bills</h2>
                <p>View and track your mess billing history</p>
            </div>
            
            <div class="card">
                <h3>Billing History</h3>
                ${result.bills.length > 0 ? `
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Month/Year</th>
                                    <th>Days</th>
                                    <th>Rate</th>
                                    <th>Total Amount</th>
                                    <th>Status</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${result.bills.map(b => `
                                    <tr>
                                        <td><strong>${getMonthName(b.month)} ${b.year}</strong></td>
                                        <td>${b.totalDays} days</td>
                                        <td>₹${b.rate}/day</td>
                                        <td><strong>₹${b.totalAmount}</strong></td>
                                        <td><span class="badge badge-${b.paymentStatus === 'paid' ? 'success' : 'warning'}">${b.paymentStatus}</span></td>
                                        <td><button class="btn btn-sm" onclick="viewBillDetails('${b._id}')">View Details</button></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : '<div class="empty-state"><p>No bills generated yet</p></div>'}
            </div>
        `;
        
        document.getElementById('content-area').innerHTML = html;
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

function getMonthName(month) {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return months[month - 1];
}

async function viewBillDetails(billId) {
    try {
        const result = await apiCall(`/mess-bill/${billId}`);
        const bill = result.bill;
        
        const modalHtml = `
            <div class="modal active" id="billModal" onclick="if(event.target === this) closeModal('billModal')">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Bill Details - ${getMonthName(bill.month)} ${bill.year}</h3>
                        <button class="modal-close" onclick="closeModal('billModal')">&times;</button>
                    </div>
                    <div>
                        <div style="margin-bottom: 20px;">
                            <p><strong>Student:</strong> ${bill.studentId.name}</p>
                            <p><strong>College ID:</strong> ${bill.studentId.collegeId}</p>
                            <p><strong>Room:</strong> ${bill.studentId.roomNumber}</p>
                        </div>
                        
                        <h4 style="margin-bottom: 16px;">Billing Details</h4>
                        <table style="margin-bottom: 24px;">
                            <tbody>
                                <tr>
                                    <td>Total Days Present</td>
                                    <td><strong>${bill.totalDays} days</strong></td>
                                </tr>
                                <tr>
                                    <td>Rate per Day</td>
                                    <td><strong>₹${bill.rate}</strong></td>
                                </tr>
                                <tr>
                                    <td>Subtotal</td>
                                    <td><strong>₹${bill.totalDays * bill.rate}</strong></td>
                                </tr>
                            </tbody>
                        </table>
                        
                        ${bill.extraCharges && bill.extraCharges.length > 0 ? `
                            <h4 style="margin-bottom: 16px;">Extra Charges</h4>
                            <table style="margin-bottom: 24px;">
                                <tbody>
                                    ${bill.extraCharges.map(charge => `
                                        <tr>
                                            <td>${charge.description}</td>
                                            <td>₹${charge.amount}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        ` : ''}
                        
                        ${bill.deductions && bill.deductions.length > 0 ? `
                            <h4 style="margin-bottom: 16px;">Deductions</h4>
                            <table style="margin-bottom: 24px;">
                                <tbody>
                                    ${bill.deductions.map(deduction => `
                                        <tr>
                                            <td>${deduction.description}</td>
                                            <td>-₹${deduction.amount}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        ` : ''}
                        
                        <div style="text-align: right; padding: 16px; background: var(--light); border-radius: 8px;">
                            <h3>Total Amount: ₹${bill.totalAmount}</h3>
                            <p style="margin-top: 8px;">Status: <span class="badge badge-${bill.paymentStatus === 'paid' ? 'success' : 'warning'}">${bill.paymentStatus}</span></p>
                            ${bill.paidDate ? `<p style="margin-top: 4px; font-size: 14px;">Paid on: ${formatDate(bill.paidDate)}</p>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.remove();
}

async function renderMyComplaints() {
    try {
        const result = await apiCall('/complaints/my');
        
        const html = `
            <div class="page-header flex-between">
                <div>
                    <h2>🔧 My Complaints</h2>
                    <p>Track and manage your maintenance requests</p>
                </div>
                <button class="btn" onclick="showNewComplaintForm()">+ New Complaint</button>
            </div>

            <div class="stats-grid">
                <div class="stat-card">
                    <h4>Total</h4>
                    <div class="stat-value">${result.stats.total}</div>
                </div>
                <div class="stat-card">
                    <h4>Pending</h4>
                    <div class="stat-value" style="color: var(--danger)">${result.stats.pending}</div>
                </div>
                <div class="stat-card">
                    <h4>In Progress</h4>
                    <div class="stat-value" style="color: var(--warning)">${result.stats.inProgress}</div>
                </div>
                <div class="stat-card">
                    <h4>Resolved</h4>
                    <div class="stat-value" style="color: var(--success)">${result.stats.resolved}</div>
                </div>
            </div>
            
            <div class="card">
                <h3>Complaint History</h3>
                ${result.complaints.length > 0 ? `
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Ticket ID</th>
                                    <th>Category</th>
                                    <th>Description</th>
                                    <th>Status</th>
                                    <th>Date</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${result.complaints.map(c => `
                                    <tr>
                                        <td><strong>${c.ticketId}</strong></td>
                                        <td><span class="badge badge-info">${c.category}</span></td>
                                        <td>${c.description.substring(0, 50)}${c.description.length > 50 ? '...' : ''}</td>
                                        <td><span class="badge badge-${c.status === 'resolved' ? 'success' : c.status === 'in_progress' ? 'warning' : 'danger'}">${c.status.replace('_', ' ')}</span></td>
                                        <td>${formatDate(c.createdAt)}</td>
                                        <td><button class="btn btn-sm" onclick="viewComplaintDetails('${c._id}')">View</button></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : '<div class="empty-state"><p>No complaints submitted yet</p></div>'}
            </div>
        `;
        
        document.getElementById('content-area').innerHTML = html;
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

function showNewComplaintForm() {
    const html = `
        <div class="page-header">
            <h2>🔧 Submit New Complaint</h2>
            <p>Report any maintenance or facility issues</p>
        </div>
        
        <div class="card">
            <h3>Complaint Details</h3>
            <form onsubmit="submitComplaint(event)">
                <div class="form-group">
                    <label>Category</label>
                    <select id="complaint-category" required>
                        <option value="">Select category</option>
                        <option value="electrical">⚡ Electrical</option>
                        <option value="plumbing">🚰 Plumbing</option>
                        <option value="wifi">📶 Wi-Fi/Internet</option>
                        <option value="cleanliness">🧹 Cleanliness</option>
                        <option value="hostel">🏠 Hostel Facility</option>
                        <option value="mess">🍽️ Mess</option>
                        <option value="security">🔒 Security</option>
                        <option value="other">📝 Other</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Priority</label>
                    <select id="complaint-priority" required>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Description</label>
                    <textarea id="complaint-description" rows="6" required placeholder="Please describe the issue in detail..." minlength="10"></textarea>
                </div>
                <div class="flex gap-2">
                    <button type="submit" class="btn">Submit Complaint</button>
                    <button type="button" class="btn btn-secondary" onclick="renderMyComplaints()">Cancel</button>
                </div>
            </form>
        </div>
    `;
    
    document.getElementById('content-area').innerHTML = html;
}

async function submitComplaint(event) {
    event.preventDefault();
    
    const data = {
        category: document.getElementById('complaint-category').value,
        description: document.getElementById('complaint-description').value,
        priority: document.getElementById('complaint-priority').value
    };

    try {
        const result = await apiCall('/complaints', 'POST', data);
        showAlert(`Complaint submitted successfully! Ticket ID: ${result.complaint.ticketId}`, 'success');
        setTimeout(() => renderMyComplaints(), 1000);
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

async function viewComplaintDetails(complaintId) {
    try {
        const result = await apiCall(`/complaints/${complaintId}`);
        const complaint = result.complaint;
        
        const modalHtml = `
            <div class="modal active" id="complaintModal" onclick="if(event.target === this) closeModal('complaintModal')">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Complaint Details</h3>
                        <button class="modal-close" onclick="closeModal('complaintModal')">&times;</button>
                    </div>
                    <div>
                        <p><strong>Ticket ID:</strong> ${complaint.ticketId}</p>
                        <p><strong>Category:</strong> <span class="badge badge-info">${complaint.category}</span></p>
                        <p><strong>Priority:</strong> <span class="badge badge-warning">${complaint.priority}</span></p>
                        <p><strong>Status:</strong> <span class="badge badge-${complaint.status === 'resolved' ? 'success' : complaint.status === 'in_progress' ? 'warning' : 'danger'}">${complaint.status.replace('_', ' ')}</span></p>
                        <p><strong>Submitted:</strong> ${formatDateTime(complaint.createdAt)}</p>
                        ${complaint.assignedTo ? `<p><strong>Assigned To:</strong> ${complaint.assignedTo.name}</p>` : ''}
                        ${complaint.resolvedAt ? `<p><strong>Resolved At:</strong> ${formatDateTime(complaint.resolvedAt)}</p>` : ''}
                        <hr style="margin: 20px 0;">
                        <p><strong>Description:</strong></p>
                        <p style="padding: 16px; background: var(--light); border-radius: 8px; margin-top: 8px;">${complaint.description}</p>
                        ${complaint.remarks ? `
                            <hr style="margin: 20px 0;">
                            <p><strong>Remarks:</strong></p>
                            <p style="padding: 16px; background: var(--light); border-radius: 8px; margin-top: 8px;">${complaint.remarks}</p>
                        ` : ''}
                        ${complaint.resolutionNotes ? `
                            <hr style="margin: 20px 0;">
                            <p><strong>Resolution Notes:</strong></p>
                            <p style="padding: 16px; background: #d1fae5; border-radius: 8px; margin-top: 8px;">${complaint.resolutionNotes}</p>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

function renderAnnouncements() {
    const user = window.currentUser || currentUser;
    const isWarden = user && (user.role === 'warden' || user.role === 'admin');
    
    const html = `
        <div class="page-header">
            <h2>📢 Announcements</h2>
            <p>${isWarden ? 'Create and manage hostel announcements' : 'Stay updated with hostel notifications'}</p>
        </div>
        
        ${isWarden ? `
            <div class="card">
                <div class="flex-between mb-3">
                    <h3>Create New Announcement</h3>
                    <span class="badge badge-primary">Warden Only</span>
                </div>
                <form onsubmit="createAnnouncement(event)">
                    <div class="form-group">
                        <label>Title</label>
                        <input type="text" id="announcement-title" required placeholder="Announcement title">
                    </div>
                    <div class="form-group">
                        <label>Content</label>
                        <textarea id="announcement-content" rows="4" required placeholder="Announcement details..."></textarea>
                    </div>
                    <div class="form-group">
                        <label>Category</label>
                        <select id="announcement-category" required>
                            <option value="">Select category</option>
                            <option value="general">📋 General</option>
                            <option value="urgent">🚨 Urgent</option>
                            <option value="maintenance">🔧 Maintenance</option>
                            <option value="event">🎉 Event</option>
                            <option value="mess">🍽️ Mess</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Target Hostel Block (Optional)</label>
                        <input type="text" id="announcement-block" placeholder="Leave empty for all blocks">
                    </div>
                    <button type="submit" class="btn">Publish Announcement</button>
                </form>
            </div>
        ` : ''}
        
        <div class="card">
            <h3>Recent Announcements</h3>
            <div id="announcements-list">
                <div class="spinner"></div>
            </div>
        </div>
    `;
    
    document.getElementById('content-area').innerHTML = html;
    loadAnnouncementsList();
}

async function loadAnnouncementsList() {
    try {
        const result = await apiCall('/announcements');
        const announcements = result.data || result.announcements || [];
        
        const listContainer = document.getElementById('announcements-list');
        
        if (announcements.length === 0) {
            listContainer.innerHTML = '<div class="empty-state"><p>No announcements yet</p></div>';
            return;
        }
        
        const html = announcements.map(announcement => `
            <div class="announcement-item" style="padding: 20px; border-left: 4px solid var(--primary); background: var(--light-gray); border-radius: var(--radius); margin-bottom: 16px; animation: slideInLeft 0.5s ease-out;">
                <div class="flex-between mb-2">
                    <h4 style="margin: 0; font-size: 18px; font-weight: 700;">${announcement.title}</h4>
                    <span class="badge badge-${getCategoryBadge(announcement.category)}">${announcement.category}</span>
                </div>
                <p style="margin: 12px 0; color: var(--text-secondary);">${announcement.content}</p>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 12px; font-size: 13px; color: var(--text-secondary);">
                    <span>📝 By ${announcement.postedBy?.name || 'Warden'}</span>
                    <span>📅 ${formatDate(announcement.createdAt)}</span>
                </div>
            </div>
        `).join('');
        
        listContainer.innerHTML = html;
    } catch (error) {
        document.getElementById('announcements-list').innerHTML = 
            '<div class="alert alert-error">Failed to load announcements</div>';
    }
}

function getCategoryBadge(category) {
    const badges = {
        'urgent': 'danger',
        'maintenance': 'warning',
        'event': 'success',
        'mess': 'info',
        'general': 'secondary'
    };
    return badges[category] || 'secondary';
}

async function createAnnouncement(event) {
    event.preventDefault();
    
    const data = {
        title: document.getElementById('announcement-title').value,
        content: document.getElementById('announcement-content').value,
        category: document.getElementById('announcement-category').value,
        targetBlocks: document.getElementById('announcement-block').value ? 
            [document.getElementById('announcement-block').value] : []
    };
    
    try {
        showLoading();
        await apiCall('/announcements', 'POST', data);
        hideLoading();
        showAlert('Announcement published successfully!', 'success');
        
        // Reset form
        event.target.reset();
        
        // Reload announcements
        loadAnnouncementsList();
    } catch (error) {
        hideLoading();
        showAlert(error.message || 'Failed to create announcement', 'error');
    }
}

// Make functions globally accessible
window.createAnnouncement = createAnnouncement;
window.loadAnnouncementsList = loadAnnouncementsList;


// ==================== WARDEN REQUEST FUNCTIONS ====================
async function renderWardenRequest() {
    try {
        showLoading();
        const result = await apiCall('/warden-requests/my-request');
        
        const html = `
            <div class="page-header">
                <h2>🎓 Request Warden Access</h2>
                <p>Apply for warden privileges to manage hostel operations</p>
            </div>
            
            ${result.request ? `
                <div class="card">
                    <h3>Your Request Status</h3>
                    <div style="background: var(--light-gray); padding: 28px; border-radius: var(--radius); margin-top: 20px;">
                        <div class="flex-between mb-3">
                            <div>
                                <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 8px;">Request Status</div>
                                <span class="badge badge-${result.request.status === 'approved' ? 'success' : result.request.status === 'rejected' ? 'danger' : 'warning'}" style="font-size: 16px; padding: 10px 20px;">
                                    ${result.request.status.toUpperCase()}
                                </span>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 8px;">Submitted</div>
                                <div style="font-size: 16px; font-weight: 700;">${formatDate(result.request.requestedAt)}</div>
                            </div>
                        </div>
                        
                        ${result.request.status === 'pending' ? `
                            <div class="alert alert-info" style="margin-top: 20px;">
                                ⏳ Your request is pending admin approval. You will be notified once reviewed.
                            </div>
                        ` : ''}
                        
                        ${result.request.status === 'approved' ? `
                            <div class="alert alert-success" style="margin-top: 20px;">
                                ✅ Congratulations! Your warden access has been approved. Please log out and log back in to access warden features.
                            </div>
                        ` : ''}
                        
                        ${result.request.status === 'rejected' ? `
                            <div class="alert alert-error" style="margin-top: 20px;">
                                ❌ Your request was not approved. ${result.request.reviewNotes || 'Please contact admin for more information.'}
                            </div>
                        ` : ''}
                        
                        ${result.request.reviewedBy ? `
                            <div style="margin-top: 20px; padding-top: 20px; border-top: 2px solid var(--border);">
                                <div style="font-size: 14px; color: var(--text-secondary);">Reviewed by: ${result.request.reviewedBy.name}</div>
                                <div style="font-size: 14px; color: var(--text-secondary);">Reviewed on: ${formatDateTime(result.request.reviewedAt)}</div>
                                ${result.request.reviewNotes ? `<div style="margin-top: 12px; padding: 12px; background: white; border-radius: var(--radius); font-size: 14px;">${result.request.reviewNotes}</div>` : ''}
                            </div>
                        ` : ''}
                    </div>
                </div>
            ` : `
                <div class="card">
                    <h3>Apply for Warden Access</h3>
                    <p style="color: var(--text-secondary); margin-bottom: 24px;">
                        Warden access allows you to manage attendance, bills, complaints, and other hostel operations. 
                        Your request will be reviewed by an administrator.
                    </p>
                    
                    <div class="alert alert-info">
                        ℹ️ Requirements:
                        <ul style="margin-top: 12px; padding-left: 20px;">
                            <li>Must be a registered student</li>
                            <li>Valid college ID</li>
                            <li>Admin approval required</li>
                        </ul>
                    </div>
                    
                    <button class="btn" onclick="submitWardenRequest()" style="margin-top: 24px;">
                        Submit Warden Request
                    </button>
                </div>
            `}
            
            <div class="card">
                <h3>ℹ️ About Warden Role</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-top: 20px;">
                    <div style="padding: 20px; background: var(--light-gray); border-radius: var(--radius);">
                        <div style="font-size: 32px; margin-bottom: 12px;">✅</div>
                        <h4 style="margin-bottom: 8px;">Attendance Management</h4>
                        <p style="font-size: 14px; color: var(--text-secondary);">Mark and verify student attendance</p>
                    </div>
                    <div style="padding: 20px; background: var(--light-gray); border-radius: var(--radius);">
                        <div style="font-size: 32px; margin-bottom: 12px;">💰</div>
                        <h4 style="margin-bottom: 8px;">Bill Management</h4>
                        <p style="font-size: 14px; color: var(--text-secondary);">Generate and manage mess bills</p>
                    </div>
                    <div style="padding: 20px; background: var(--light-gray); border-radius: var(--radius);">
                        <div style="font-size: 32px; margin-bottom: 12px;">🔧</div>
                        <h4 style="margin-bottom: 8px;">Complaint Resolution</h4>
                        <p style="font-size: 14px; color: var(--text-secondary);">Handle student complaints</p>
                    </div>
                    <div style="padding: 20px; background: var(--light-gray); border-radius: var(--radius);">
                        <div style="font-size: 32px; margin-bottom: 12px;">📊</div>
                        <h4 style="margin-bottom: 8px;">Reports & Analytics</h4>
                        <p style="font-size: 14px; color: var(--text-secondary);">Access detailed reports</p>
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('content-area').innerHTML = html;
        hideLoading();
    } catch (error) {
        hideLoading();
        showAlert(error.message, 'error');
    }
}

async function submitWardenRequest() {
    try {
        console.log('📝 Submitting warden request...');
        showLoading();
        const result = await apiCall('/warden-requests', 'POST');
        console.log('✅ Request submitted:', result);
        hideLoading();
        showAlert(result.message, 'success');
        setTimeout(() => renderWardenRequest(), 1500);
    } catch (error) {
        console.error('❌ Error submitting request:', error);
        hideLoading();
        showAlert(error.message, 'error');
    }
}

// Make functions globally accessible
window.renderWardenRequest = renderWardenRequest;
window.submitWardenRequest = submitWardenRequest;


// ==================== ADMIN DASHBOARD FUNCTIONS ====================

async function renderAdminDashboard() {
    try {
        showLoading();
        
        // Fetch data using warden-requests API
        const wardenRequestsRes = await apiCall('/warden-requests?status=pending');
        
        // Try to get all users, but don't fail if it doesn't work
        let allUsersRes = { data: [], count: 0 };
        try {
            allUsersRes = await apiCall('/auth/users');
        } catch (error) {
            console.log('Could not fetch users:', error);
        }
        
        const pendingCount = wardenRequestsRes.requests ? wardenRequestsRes.requests.length : 0;
        const totalUsers = allUsersRes.count || allUsersRes.data?.length || 0;
        
        const html = `
            <div class="page-header">
                <h2>👑 Admin Dashboard</h2>
                <p>Manage all hostel operations and approvals</p>
            </div>
            
            <!-- Quick Stats -->
            <div class="stats-grid">
                <div class="stat-card hover-lift">
                    <h4>Pending Wardens</h4>
                    <div class="stat-value" style="color: var(--warning)">${pendingCount}</div>
                    <div class="stat-label">Awaiting approval</div>
                </div>
                <div class="stat-card hover-lift">
                    <h4>Total Wardens</h4>
                    <div class="stat-value" style="color: var(--info)">${wardenRequestsRes.stats?.approved || 0}</div>
                    <div class="stat-label">Approved wardens</div>
                </div>
                <div class="stat-card hover-lift">
                    <h4>Total Students</h4>
                    <div class="stat-value" style="color: var(--success)">${allUsersRes.data ? allUsersRes.data.filter(u => u.role === 'student').length : 0}</div>
                    <div class="stat-label">Registered students</div>
                </div>
                <div class="stat-card hover-lift">
                    <h4>Total Users</h4>
                    <div class="stat-value" style="color: var(--primary)">${totalUsers}</div>
                    <div class="stat-label">All users</div>
                </div>
            </div>
            
            <!-- Quick Actions -->
            <div class="quick-actions">
                <div class="quick-action-card" onclick="loadView('pendingWardens')">
                    <div class="icon">👥</div>
                    <h4>Approve Wardens</h4>
                    <p>${pendingCount} pending</p>
                </div>
                <div class="quick-action-card" onclick="loadView('allUsers')">
                    <div class="icon">👤</div>
                    <h4>Manage Users</h4>
                    <p>View all users</p>
                </div>
                <div class="quick-action-card" onclick="loadView('manageAnnouncements')">
                    <div class="icon">📢</div>
                    <h4>Announcements</h4>
                    <p>Manage announcements</p>
                </div>
            </div>
            
            <!-- Recent Pending Wardens -->
            ${pendingCount > 0 ? `
                <div class="card">
                    <div class="flex-between mb-3">
                        <h3>🚨 Pending Warden Requests</h3>
                        <button class="btn btn-sm" onclick="loadView('pendingWardens')">View All</button>
                    </div>
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>College ID</th>
                                    <th>Requested</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${wardenRequestsRes.requests.slice(0, 5).map(request => `
                                    <tr>
                                        <td><strong>${request.name}</strong></td>
                                        <td>${request.email}</td>
                                        <td>${request.collegeId}</td>
                                        <td>${formatDate(request.requestedAt)}</td>
                                        <td>
                                            <button class="btn btn-sm btn-success" onclick="reviewWardenRequest('${request._id}', 'approve')">✅ Approve</button>
                                            <button class="btn btn-sm btn-danger" onclick="reviewWardenRequest('${request._id}', 'reject')">❌ Reject</button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            ` : ''}
        `;
        
        document.getElementById('content-area').innerHTML = html;
        hideLoading();
    } catch (error) {
        hideLoading();
        showAlert(error.message, 'error');
    }
}

async function renderPendingWardens() {
    try {
        showLoading();
        console.log('🔍 Fetching warden requests...');
        
        // Fetch all warden requests to show stats
        const allRequestsResult = await apiCall('/warden-requests');
        console.log('📊 All requests result:', allRequestsResult);
        
        const pendingResult = await apiCall('/warden-requests?status=pending');
        console.log('📋 Pending requests result:', pendingResult);
        
        const html = `
            <div class="page-header">
                <h2>👥 Warden Access Requests</h2>
                <p>Review and manage warden access requests from students</p>
            </div>
            
            <!-- Stats Grid -->
            <div class="stats-grid">
                <div class="stat-card hover-lift">
                    <h4>Total Requests</h4>
                    <div class="stat-value">${allRequestsResult.stats.total}</div>
                    <div class="stat-label">All time</div>
                </div>
                <div class="stat-card hover-lift">
                    <h4>Pending</h4>
                    <div class="stat-value" style="color: var(--warning)">${allRequestsResult.stats.pending}</div>
                    <div class="stat-label">Awaiting review</div>
                </div>
                <div class="stat-card hover-lift">
                    <h4>Approved</h4>
                    <div class="stat-value" style="color: var(--success)">${allRequestsResult.stats.approved}</div>
                    <div class="stat-label">Active wardens</div>
                </div>
                <div class="stat-card hover-lift">
                    <h4>Rejected</h4>
                    <div class="stat-value" style="color: var(--danger)">${allRequestsResult.stats.rejected}</div>
                    <div class="stat-label">Declined</div>
                </div>
            </div>
            
            <div class="card">
                <div class="flex-between mb-3">
                    <h3>🚨 Pending Requests (${pendingResult.requests ? pendingResult.requests.length : 0})</h3>
                    <div class="flex gap-2">
                        <select onchange="filterRequestsByStatus(this.value)" style="padding: 8px 16px; border-radius: 8px; border: 2px solid var(--border);">
                            <option value="pending">Pending Only</option>
                            <option value="all">All Requests</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                        </select>
                        <button class="btn btn-secondary btn-sm" onclick="loadAllWardenRequests()">View All History</button>
                    </div>
                </div>
                
                ${pendingResult.requests && pendingResult.requests.length > 0 ? `
                    <div class="table-container">
                        <table id="wardenRequestsTable">
                            <thead>
                                <tr>
                                    <th>Student Name</th>
                                    <th>Email</th>
                                    <th>College ID</th>
                                    <th>Department</th>
                                    <th>Phone</th>
                                    <th>Requested On</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${pendingResult.requests.map(request => `
                                    <tr data-status="${request.status}">
                                        <td><strong>${request.name}</strong></td>
                                        <td>${request.email}</td>
                                        <td><span class="badge badge-info">${request.collegeId}</span></td>
                                        <td>${request.department || 'N/A'}</td>
                                        <td>${request.phoneNumber || 'N/A'}</td>
                                        <td>${formatDateTime(request.requestedAt)}</td>
                                        <td>
                                            <div class="flex gap-1">
                                                <button class="btn btn-sm btn-success" onclick="reviewWardenRequest('${request._id}', 'approve')" title="Approve Request">
                                                    ✅ Approve
                                                </button>
                                                <button class="btn btn-sm btn-danger" onclick="reviewWardenRequest('${request._id}', 'reject')" title="Reject Request">
                                                    ❌ Reject
                                                </button>
                                                <button class="btn btn-sm" onclick="viewRequestDetails('${request._id}')" title="View Details">
                                                    👁️ View
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : `
                    <div class="empty-state">
                        <div style="font-size: 64px; margin-bottom: 16px;">✅</div>
                        <h3>No Pending Requests</h3>
                        <p>All warden requests have been reviewed. Great job!</p>
                    </div>
                `}
            </div>
            
            ${allRequestsResult.stats.pending > 0 ? `
                <div class="alert alert-info">
                    <strong>💡 Quick Tip:</strong> Review pending requests promptly to help students access warden features. 
                    Approved wardens can manage attendance, bills, and complaints.
                </div>
            ` : ''}
        `;
        
        document.getElementById('content-area').innerHTML = html;
        hideLoading();
        
    } catch (error) {
        hideLoading();
        console.error('Error loading warden requests:', error);
        showAlert(error.message || 'Failed to load warden requests', 'error');
    }
}

async function renderPendingStudents() {
    try {
        showLoading();
        const result = await apiCall('/approvals/pending-students');
        
        const html = `
            <div class="page-header">
                <h2>🎓 Pending Student Requests</h2>
                <p>Review and approve student registrations</p>
            </div>
            
            <div class="card">
                <h3>Student Requests (${result.count || 0})</h3>
                ${result.data && result.data.length > 0 ? `
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>College ID</th>
                                    <th>Room</th>
                                    <th>Department</th>
                                    <th>Requested</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${result.data.map(user => `
                                    <tr>
                                        <td><strong>${user.name}</strong></td>
                                        <td>${user.email}</td>
                                        <td>${user.collegeId}</td>
                                        <td>${user.roomNumber || 'N/A'}</td>
                                        <td>${user.department || 'N/A'}</td>
                                        <td>${formatDateTime(user.createdAt)}</td>
                                        <td>
                                            <button class="btn btn-sm btn-success" onclick="approveUser('${user._id}', 'student')">✅ Approve</button>
                                            <button class="btn btn-sm btn-danger" onclick="rejectUser('${user._id}', 'student')">❌ Reject</button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : '<div class="empty-state"><p>No pending student requests</p></div>'}
            </div>
        `;
        
        document.getElementById('content-area').innerHTML = html;
        hideLoading();
        
    } catch (error) {
        hideLoading();
        showAlert(error.message, 'error');
    }
}

async function renderPendingAttendance() {
    try {
        showLoading();
        const result = await apiCall('/attendance-approval/pending');
        
        const html = `
            <div class="page-header">
                <h2>✅ Pending Attendance Verification</h2>
                <p>Review and approve student attendance records</p>
            </div>
            
            <div class="card">
                <h3>Pending Attendance (${result.count || 0})</h3>
                ${result.data && result.data.length > 0 ? `
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Student</th>
                                    <th>College ID</th>
                                    <th>Room</th>
                                    <th>Date</th>
                                    <th>Marked At</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${result.data.map(att => `
                                    <tr>
                                        <td><strong>${att.studentId?.name || 'N/A'}</strong></td>
                                        <td>${att.studentId?.collegeId || 'N/A'}</td>
                                        <td>${att.studentId?.roomNumber || 'N/A'}</td>
                                        <td>${formatDate(att.date)}</td>
                                        <td>${formatDateTime(att.markedAt)}</td>
                                        <td>
                                            <span class="badge badge-warning">Pending</span>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : '<div class="empty-state"><p>No pending attendance records</p></div>'}
            </div>
        `;
        
        document.getElementById('content-area').innerHTML = html;
        hideLoading();
    } catch (error) {
        hideLoading();
        showAlert(error.message, 'error');
    }
}

async function renderAllUsers() {
    try {
        showLoading();
        const result = await apiCall('/auth/users');
        
        // Group users by role
        const usersByRole = {
            admin: result.data.filter(u => u.role === 'admin'),
            warden: result.data.filter(u => u.role === 'warden'),
            student: result.data.filter(u => u.role === 'student')
        };
        
        const html = `
            <div class="page-header">
                <h2>👤 All Users</h2>
                <p>Manage all registered users in the system</p>
            </div>
            
            <div class="stats-grid">
                <div class="stat-card">
                    <h4>Admins</h4>
                    <div class="stat-value">${usersByRole.admin.length}</div>
                </div>
                <div class="stat-card">
                    <h4>Wardens</h4>
                    <div class="stat-value">${usersByRole.warden.length}</div>
                </div>
                <div class="stat-card">
                    <h4>Students</h4>
                    <div class="stat-value">${usersByRole.student.length}</div>
                </div>
                <div class="stat-card">
                    <h4>Total</h4>
                    <div class="stat-value">${result.count || 0}</div>
                </div>
            </div>
            
            <div class="card">
                <h3>All Users</h3>
                ${result.data && result.data.length > 0 ? `
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>College ID</th>
                                    <th>Role</th>
                                    <th>Status</th>
                                    <th>Registered</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${result.data.map(user => `
                                    <tr>
                                        <td><strong>${user.name}</strong></td>
                                        <td>${user.email}</td>
                                        <td>${user.collegeId}</td>
                                        <td><span class="badge badge-info">${user.role}</span></td>
                                        <td><span class="badge badge-${user.approvalStatus === 'approved' ? 'success' : user.approvalStatus === 'rejected' ? 'danger' : 'warning'}">${user.approvalStatus}</span></td>
                                        <td>${formatDate(user.createdAt)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : '<div class="empty-state"><p>No users found</p></div>'}
            </div>
        `;
        
        document.getElementById('content-area').innerHTML = html;
        hideLoading();
    } catch (error) {
        hideLoading();
        showAlert(error.message, 'error');
    }
}

async function filterRequestsByStatus(status) {
    if (status === 'all') {
        loadAllWardenRequests();
    } else if (status === 'pending') {
        renderPendingWardens();
    } else {
        loadAllWardenRequests(status);
    }
}

async function loadAllWardenRequests(filterStatus = '') {
    try {
        showLoading();
        const url = filterStatus ? `/warden-requests?status=${filterStatus}` : '/warden-requests';
        const result = await apiCall(url);
        
        const html = `
            <div class="page-header">
                <h2>👥 All Warden Requests</h2>
                <p>Complete history of warden access requests</p>
            </div>
            
            <!-- Stats Grid -->
            <div class="stats-grid">
                <div class="stat-card hover-lift">
                    <h4>Total Requests</h4>
                    <div class="stat-value">${result.stats.total}</div>
                </div>
                <div class="stat-card hover-lift">
                    <h4>Pending</h4>
                    <div class="stat-value" style="color: var(--warning)">${result.stats.pending}</div>
                </div>
                <div class="stat-card hover-lift">
                    <h4>Approved</h4>
                    <div class="stat-value" style="color: var(--success)">${result.stats.approved}</div>
                </div>
                <div class="stat-card hover-lift">
                    <h4>Rejected</h4>
                    <div class="stat-value" style="color: var(--danger)">${result.stats.rejected}</div>
                </div>
            </div>
            
            <div class="card">
                <div class="flex-between mb-3">
                    <h3>All Requests (${result.requests.length})</h3>
                    <div class="flex gap-2">
                        <select onchange="filterRequestsByStatus(this.value)" style="padding: 8px 16px; border-radius: 8px; border: 2px solid var(--border);">
                            <option value="all" ${!filterStatus ? 'selected' : ''}>All Status</option>
                            <option value="pending" ${filterStatus === 'pending' ? 'selected' : ''}>Pending</option>
                            <option value="approved" ${filterStatus === 'approved' ? 'selected' : ''}>Approved</option>
                            <option value="rejected" ${filterStatus === 'rejected' ? 'selected' : ''}>Rejected</option>
                        </select>
                        <button class="btn btn-secondary btn-sm" onclick="renderPendingWardens()">Back to Pending</button>
                    </div>
                </div>
                
                ${result.requests.length > 0 ? `
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Student Name</th>
                                    <th>Email</th>
                                    <th>College ID</th>
                                    <th>Status</th>
                                    <th>Requested On</th>
                                    <th>Reviewed By</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${result.requests.map(request => `
                                    <tr>
                                        <td><strong>${request.name}</strong></td>
                                        <td>${request.email}</td>
                                        <td><span class="badge badge-info">${request.collegeId}</span></td>
                                        <td>
                                            <span class="badge badge-${request.status === 'approved' ? 'success' : request.status === 'rejected' ? 'danger' : 'warning'}">
                                                ${request.status.toUpperCase()}
                                            </span>
                                        </td>
                                        <td>${formatDateTime(request.requestedAt)}</td>
                                        <td>${request.reviewedBy ? request.reviewedBy.name : '-'}</td>
                                        <td>
                                            ${request.status === 'pending' ? `
                                                <button class="btn btn-sm btn-success" onclick="reviewWardenRequest('${request._id}', 'approve')">✅ Approve</button>
                                                <button class="btn btn-sm btn-danger" onclick="reviewWardenRequest('${request._id}', 'reject')">❌ Reject</button>
                                            ` : `
                                                <button class="btn btn-sm" onclick="viewRequestDetails('${request._id}')">👁️ View</button>
                                            `}
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : '<div class="empty-state"><p>No requests found</p></div>'}
            </div>
        `;
        
        document.getElementById('content-area').innerHTML = html;
        hideLoading();
    } catch (error) {
        hideLoading();
        showAlert(error.message || 'Failed to load requests', 'error');
    }
}

async function viewRequestDetails(requestId) {
    try {
        const result = await apiCall(`/warden-requests/${requestId}`);
        const request = result.request;
        
        const modalHtml = `
            <div class="modal active" id="requestDetailsModal" onclick="if(event.target === this) closeModal('requestDetailsModal')">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Warden Request Details</h3>
                        <button class="modal-close" onclick="closeModal('requestDetailsModal')">&times;</button>
                    </div>
                    <div>
                        <div style="background: var(--light-gray); padding: 20px; border-radius: var(--radius); margin-bottom: 20px;">
                            <div class="flex-between mb-3">
                                <h4 style="margin: 0;">Request Status</h4>
                                <span class="badge badge-${request.status === 'approved' ? 'success' : request.status === 'rejected' ? 'danger' : 'warning'}" style="font-size: 16px; padding: 8px 16px;">
                                    ${request.status.toUpperCase()}
                                </span>
                            </div>
                        </div>
                        
                        <h4 style="margin-bottom: 16px;">Student Information</h4>
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 24px;">
                            <div>
                                <p style="color: var(--text-secondary); font-size: 13px; margin-bottom: 4px;">Name</p>
                                <p style="font-weight: 600;">${request.name}</p>
                            </div>
                            <div>
                                <p style="color: var(--text-secondary); font-size: 13px; margin-bottom: 4px;">Email</p>
                                <p style="font-weight: 600;">${request.email}</p>
                            </div>
                            <div>
                                <p style="color: var(--text-secondary); font-size: 13px; margin-bottom: 4px;">College ID</p>
                                <p style="font-weight: 600;">${request.collegeId}</p>
                            </div>
                            <div>
                                <p style="color: var(--text-secondary); font-size: 13px; margin-bottom: 4px;">Phone</p>
                                <p style="font-weight: 600;">${request.phoneNumber || 'N/A'}</p>
                            </div>
                            <div>
                                <p style="color: var(--text-secondary); font-size: 13px; margin-bottom: 4px;">Department</p>
                                <p style="font-weight: 600;">${request.department || 'N/A'}</p>
                            </div>
                            <div>
                                <p style="color: var(--text-secondary); font-size: 13px; margin-bottom: 4px;">Requested On</p>
                                <p style="font-weight: 600;">${formatDateTime(request.requestedAt)}</p>
                            </div>
                        </div>
                        
                        ${request.reviewedBy ? `
                            <hr style="margin: 24px 0;">
                            <h4 style="margin-bottom: 16px;">Review Information</h4>
                            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 16px;">
                                <div>
                                    <p style="color: var(--text-secondary); font-size: 13px; margin-bottom: 4px;">Reviewed By</p>
                                    <p style="font-weight: 600;">${request.reviewedBy.name}</p>
                                </div>
                                <div>
                                    <p style="color: var(--text-secondary); font-size: 13px; margin-bottom: 4px;">Reviewed On</p>
                                    <p style="font-weight: 600;">${formatDateTime(request.reviewedAt)}</p>
                                </div>
                            </div>
                            ${request.reviewNotes ? `
                                <div>
                                    <p style="color: var(--text-secondary); font-size: 13px; margin-bottom: 8px;">Review Notes</p>
                                    <p style="padding: 16px; background: var(--light-gray); border-radius: var(--radius);">${request.reviewNotes}</p>
                                </div>
                            ` : ''}
                        ` : ''}
                        
                        ${request.status === 'pending' ? `
                            <hr style="margin: 24px 0;">
                            <div class="flex gap-2">
                                <button class="btn btn-success" onclick="closeModal('requestDetailsModal'); reviewWardenRequest('${request._id}', 'approve')">
                                    ✅ Approve Request
                                </button>
                                <button class="btn btn-danger" onclick="closeModal('requestDetailsModal'); reviewWardenRequest('${request._id}', 'reject')">
                                    ❌ Reject Request
                                </button>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    } catch (error) {
        showAlert(error.message || 'Failed to load request details', 'error');
    }
}


// Approval functions removed - system simplified

// Make admin functions globally accessible
window.renderAdminDashboard = renderAdminDashboard;
window.renderPendingWardens = renderPendingWardens;
window.renderAllUsers = renderAllUsers;
window.filterRequestsByStatus = filterRequestsByStatus;
window.loadAllWardenRequests = loadAllWardenRequests;
window.viewRequestDetails = viewRequestDetails;

// Make all dashboard functions globally accessible
window.loadDashboard = loadDashboard;
window.loadView = loadView;
window.submitMyAttendance = submitMyAttendance;
window.viewBillDetails = viewBillDetails;
window.closeModal = closeModal;
window.showNewComplaintForm = showNewComplaintForm;
window.submitComplaint = submitComplaint;
window.viewComplaintDetails = viewComplaintDetails;
window.renderMyComplaints = renderMyComplaints;
window.renderMyAttendance = renderMyAttendance;
window.renderAnnouncements = renderAnnouncements;
window.getMonthName = getMonthName;

console.log('Dashboard.js loaded - all functions exposed');


// ==================== WARDEN REQUEST REVIEW FUNCTIONS ====================

/**
 * Review warden request - approve or reject
 * @param {string} requestId - The warden request ID
 * @param {string} action - Either 'approve' or 'reject'
 */
async function reviewWardenRequest(requestId, action) {
    try {
        // Confirm action
        const actionText = action === 'approve' ? 'approve' : 'reject';
        const confirmMessage = `Are you sure you want to ${actionText} this warden request?`;
        
        if (!confirm(confirmMessage)) {
            return;
        }

        // Get rejection reason if rejecting
        let notes = null;
        if (action === 'reject') {
            notes = prompt('Enter rejection reason (optional):');
            if (notes === null) return; // User cancelled
        }

        // Show loading
        if (window.showLoading) window.showLoading();

        // Make API call to /api/warden-requests/:id/approve or /api/warden-requests/:id/reject
        const endpoint = `/warden-requests/${requestId}/${action}`;
        const body = notes ? { notes } : {};
        
        const response = await apiCall(endpoint, 'PUT', body);

        // Hide loading
        if (window.hideLoading) window.hideLoading();

        if (response.success) {
            showAlert(`Request ${action}d successfully!`, 'success');
            
            // Reload the pending wardens list
            setTimeout(() => {
                renderPendingWardens();
            }, 1000);
        } else {
            showAlert(response.message || `Failed to ${action} request`, 'error');
        }
    } catch (error) {
        if (window.hideLoading) window.hideLoading();
        console.error(`Error ${action}ing warden request:`, error);
        showAlert(error.message || `Error ${action}ing request`, 'error');
    }
}

// Expose the function globally
window.reviewWardenRequest = reviewWardenRequest;
