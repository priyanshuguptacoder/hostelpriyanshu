/**
 * Hostel Management System - Warden Module
 * 
 * @author Priyanshu
 * @copyright 2026 Priyanshu. All Rights Reserved.
 */

// ==================== WARDEN VIEWS ====================

async function renderWardenDashboard() {
    try {
        const today = new Date();
        const month = today.getMonth() + 1;
        const year = today.getFullYear();

        // Fetch data in parallel
        const [todayResult, billSummary, complaintsResult] = await Promise.all([
            apiCall('/attendance/today'),
            apiCall(`/mess-bill/summary/${month}/${year}`).catch(() => ({ summary: { totalBills: 0, pendingCount: 0, totalAmount: 0, paidAmount: 0 } })),
            apiCall('/complaints')
        ]);

        // Calculate percentages
        const attendanceRate = todayResult.stats.totalStudents > 0 
            ? Math.round((todayResult.stats.present / todayResult.stats.totalStudents) * 100) 
            : 0;
        const billCollectionRate = billSummary.summary.totalAmount > 0
            ? Math.round((billSummary.summary.paidAmount / billSummary.summary.totalAmount) * 100)
            : 0;

        const html = `
            <div class="page-header">
                <h2>Warden Dashboard 👨‍💼</h2>
                <p>Manage hostel operations and monitor activities - ${getMonthName(month)} ${year}</p>
            </div>
            
            <!-- Quick Actions -->
            <div class="quick-actions">
                <div class="quick-action-card" onclick="loadView('markAttendance')">
                    <div class="icon">✅</div>
                    <h4>Mark Attendance</h4>
                </div>
                <div class="quick-action-card" onclick="loadView('manageBills')">
                    <div class="icon">💰</div>
                    <h4>Manage Bills</h4>
                </div>
                <div class="quick-action-card" onclick="loadView('allComplaints')">
                    <div class="icon">🔧</div>
                    <h4>View Complaints</h4>
                </div>
                <div class="quick-action-card" onclick="loadView('attendanceReport')">
                    <div class="icon">📊</div>
                    <h4>Reports</h4>
                </div>
            </div>
            
            <!-- Stats Grid -->
            <div class="stats-grid">
                <div class="stat-card hover-lift">
                    <h4>Total Students</h4>
                    <div class="stat-value">${todayResult.stats.totalStudents}</div>
                    <div class="stat-label">Registered</div>
                </div>
                <div class="stat-card hover-lift">
                    <h4>Today Present</h4>
                    <div class="stat-value" style="color: var(--success)">${todayResult.stats.present}</div>
                    <div class="stat-label">Out of ${todayResult.stats.marked}</div>
                </div>
                <div class="stat-card hover-lift">
                    <h4>Pending Complaints</h4>
                    <div class="stat-value" style="color: var(--warning)">${complaintsResult.stats.pending}</div>
                    <div class="stat-label">Need attention</div>
                </div>
                <div class="stat-card hover-lift">
                    <h4>Pending Bills</h4>
                    <div class="stat-value" style="color: var(--danger)">${billSummary.summary.pendingCount}</div>
                    <div class="stat-label">Unpaid</div>
                </div>
            </div>

            <!-- Attendance Overview -->
            <div class="card">
                <div class="flex-between mb-3">
                    <h3>📊 Today's Attendance Summary</h3>
                    <button class="btn btn-sm" onclick="viewTodayAttendance()">View Details</button>
                </div>
                ${createProgressChart(attendanceRate, 'Attendance Rate')}
                <div class="stats-grid" style="margin-top: 20px;">
                    <div class="stat-card">
                        <h4>Marked</h4>
                        <div class="stat-value">${todayResult.stats.marked}</div>
                    </div>
                    <div class="stat-card">
                        <h4>Not Marked</h4>
                        <div class="stat-value">${todayResult.stats.notMarked}</div>
                    </div>
                    <div class="stat-card">
                        <h4>Present</h4>
                        <div class="stat-value" style="color: var(--success)">${todayResult.stats.present}</div>
                    </div>
                    <div class="stat-card">
                        <h4>Absent</h4>
                        <div class="stat-value" style="color: var(--danger)">${todayResult.stats.absent}</div>
                    </div>
                </div>
            </div>

            <!-- Financial Overview -->
            ${billSummary.summary.totalBills > 0 ? `
                <div class="card">
                    <h3>💰 Financial Overview</h3>
                    ${createProgressChart(billCollectionRate, 'Bill Collection Rate')}
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-top: 20px;">
                        <div style="text-align: center; padding: 20px; background: var(--light-gray); border-radius: var(--radius);">
                            <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 8px;">Total Amount</div>
                            <div style="font-size: 28px; font-weight: 800; color: var(--primary);">₹${billSummary.summary.totalAmount}</div>
                        </div>
                        <div style="text-align: center; padding: 20px; background: var(--light-gray); border-radius: var(--radius);">
                            <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 8px;">Collected</div>
                            <div style="font-size: 28px; font-weight: 800; color: var(--success);">₹${billSummary.summary.paidAmount}</div>
                        </div>
                        <div style="text-align: center; padding: 20px; background: var(--light-gray); border-radius: var(--radius);">
                            <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 8px;">Pending</div>
                            <div style="font-size: 28px; font-weight: 800; color: var(--danger);">₹${billSummary.summary.pendingAmount}</div>
                        </div>
                    </div>
                </div>
            ` : ''}

            <!-- Recent Complaints -->
            <div class="card">
                <div class="flex-between mb-3">
                    <h3>🔧 Recent Complaints</h3>
                    <button class="btn btn-sm" onclick="loadView('allComplaints')">View All</button>
                </div>
                ${complaintsResult.complaints.slice(0, 5).length > 0 ? `
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Ticket ID</th>
                                    <th>Student</th>
                                    <th>Category</th>
                                    <th>Priority</th>
                                    <th>Status</th>
                                    <th>Date</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${complaintsResult.complaints.slice(0, 5).map(c => `
                                    <tr>
                                        <td><strong>${c.ticketId}</strong></td>
                                        <td>${c.studentId ? c.studentId.name : 'N/A'}</td>
                                        <td><span class="badge badge-info">${c.category}</span></td>
                                        <td><span class="badge badge-warning">${c.priority}</span></td>
                                        <td><span class="badge badge-${c.status === 'resolved' ? 'success' : c.status === 'in_progress' ? 'warning' : 'danger'}">${c.status.replace('_', ' ')}</span></td>
                                        <td>${formatDate(c.createdAt)}</td>
                                        <td><button class="btn btn-sm" onclick="manageComplaint('${c._id}')">Manage</button></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : '<div class="empty-state"><p>No complaints</p></div>'}
            </div>
        `;
        
        document.getElementById('content-area').innerHTML = html;
    } catch (error) {
        if (error.name === 'AbortError') throw error;
        showAlert(error.message, 'error');
    }
}

async function renderMarkAttendance() {
    const html = `
        <div class="page-header">
            <h2>✅ Mark Attendance</h2>
            <p>Record student attendance</p>
        </div>
        
        <div class="card">
            <h3>Mark Attendance for Student</h3>
            <form onsubmit="markStudentAttendance(event)">
                <div class="form-group">
                    <label>Student College ID or Email</label>
                    <input type="text" id="att-student-identifier" required placeholder="CS2024001 or student@college.edu">
                    <small style="color: #6b7280;">Enter college ID or email to find student</small>
                </div>
                <div class="form-group">
                    <label>Date</label>
                    <input type="date" id="att-date" required value="${new Date().toISOString().split('T')[0]}">
                </div>
                <div class="form-group">
                    <label>Status</label>
                    <select id="att-status" required>
                        <option value="present">✅ Present</option>
                        <option value="absent">❌ Absent</option>
                        <option value="late">⏰ Late Entry</option>
                        <option value="leave">🏖️ On Leave</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Remarks (Optional)</label>
                    <input type="text" id="att-remarks" placeholder="Any additional notes...">
                </div>
                <button type="submit" class="btn">Mark Attendance</button>
            </form>
        </div>

        <div class="card">
            <h3>📊 Today's Attendance</h3>
            <button class="btn btn-secondary" onclick="viewTodayAttendance()">View Today's Records</button>
        </div>
    `;
    
    document.getElementById('content-area').innerHTML = html;
}

async function markStudentAttendance(event) {
    event.preventDefault();
    
    const identifier = document.getElementById('att-student-identifier').value;
    const date = document.getElementById('att-date').value;
    const status = document.getElementById('att-status').value;
    const remarks = document.getElementById('att-remarks').value;
    
    try {
        // First, find the student by identifier
        const searchResult = await apiCall(`/auth/users?search=${identifier}`);
        
        if (!searchResult.data || searchResult.data.length === 0) {
            showAlert('Student not found. Please check the College ID or Email.', 'error');
            return;
        }
        
        // Find student from results
        const student = searchResult.data.find(u => 
            u.role === 'student' && 
            (u.collegeId.toLowerCase() === identifier.toLowerCase() || 
             u.email.toLowerCase() === identifier.toLowerCase())
        );
        
        if (!student) {
            showAlert('Student not found. Please check the College ID or Email.', 'error');
            return;
        }
        
        // Mark attendance
        const data = {
            studentId: student._id,
            date: date,
            status: status,
            remarks: remarks
        };
        
        const result = await apiCall('/attendance/mark', 'POST', data);
        showAlert(`Attendance marked successfully for ${student.name}!`, 'success');
        
        // Clear form
        document.getElementById('att-student-identifier').value = '';
        document.getElementById('att-remarks').value = '';
        
    } catch (error) {
        if (error.name === 'AbortError') throw error;
        showAlert(error.message, 'error');
    }
}

async function viewTodayAttendance() {
    try {
        const result = await apiCall('/attendance/today');
        
        const html = `
            <div class="page-header">
                <h2>� Today's Attendance</h2>
                <p>${formatDate(result.date)}</p>
            </div>

            <div class="stats-grid">
                <div class="stat-card">
                    <h4>Total Students</h4>
                    <div class="stat-value">${result.stats.totalStudents}</div>
                </div>
                <div class="stat-card">
                    <h4>Marked</h4>
                    <div class="stat-value">${result.stats.marked}</div>
                </div>
                <div class="stat-card">
                    <h4>Present</h4>
                    <div class="stat-value" style="color: var(--success)">${result.stats.present}</div>
                </div>
                <div class="stat-card">
                    <h4>Absent</h4>
                    <div class="stat-value" style="color: var(--danger)">${result.stats.absent}</div>
                </div>
            </div>
            
            <div class="card">
                <div class="flex-between mb-3">
                    <h3>Attendance Records</h3>
                    <button class="btn btn-secondary" onclick="renderMarkAttendance()">Back</button>
                </div>
                ${result.attendance.length > 0 ? `
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Student</th>
                                    <th>College ID</th>
                                    <th>Room</th>
                                    <th>Status</th>
                                    <th>Marked At</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${result.attendance.map(a => {
                                    const student = a.studentId || {};
                                    return `
                                    <tr>
                                        <td>${student.name || 'Deleted / Unknown'}</td>
                                        <td>${student.collegeId || 'N/A'}</td>
                                        <td>${student.roomNumber || 'N/A'}</td>
                                        <td><span class="badge badge-${a.status === 'present' ? 'success' : 'danger'}">${a.status}</span></td>
                                        <td>${formatDateTime(a.markedAt)}</td>
                                    </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : '<div class="empty-state"><p>No attendance marked today</p></div>'}
            </div>
        `;
        
        document.getElementById('content-area').innerHTML = html;
    } catch (error) {
        if (error.name === 'AbortError') throw error;
        showAlert(error.message, 'error');
    }
}

async function renderAttendanceReport() {
    try {
        const today = new Date();
        const month = today.getMonth() + 1;
        const year = today.getFullYear();
        
        const result = await apiCall(`/attendance/report?month=${month}&year=${year}`);
        
        const html = `
            <div class="page-header">
                <h2>📋 Attendance Report</h2>
                <p>${getMonthName(month)} ${year}</p>
            </div>

            <div class="card">
                <h3>Monthly Attendance Report</h3>
                <p style="margin-bottom: 20px;">Total Students: ${result.totalStudents}</p>
                ${result.report.length > 0 ? `
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Student</th>
                                    <th>College ID</th>
                                    <th>Room</th>
                                    <th>Present</th>
                                    <th>Absent</th>
                                    <th>Total</th>
                                    <th>Percentage</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${result.report.map(r => `
                                    <tr>
                                        <td>${r.student.name}</td>
                                        <td>${r.student.collegeId}</td>
                                        <td>${r.student.roomNumber}</td>
                                        <td><span class="badge badge-success">${r.attendance.present}</span></td>
                                        <td><span class="badge badge-danger">${r.attendance.absent}</span></td>
                                        <td>${r.attendance.total}</td>
                                        <td><strong>${r.attendance.percentage}%</strong></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : '<div class="empty-state"><p>No attendance data available</p></div>'}
            </div>
        `;
        
        document.getElementById('content-area').innerHTML = html;
    } catch (error) {
        if (error.name === 'AbortError') throw error;
        showAlert(error.message, 'error');
    }
}

async function renderManageBills() {
    try {
        const today = new Date();
        const month = today.getMonth() + 1;
        const year = today.getFullYear();
        
        const result = await apiCall(`/mess-bill/summary/${month}/${year}`).catch(() => ({ 
            summary: { totalBills: 0, totalAmount: 0, paidAmount: 0, pendingAmount: 0 },
            bills: []
        }));
        
        const html = `
            <div class="page-header">
                <h2>💰 Manage Mess Bills</h2>
                <p>${getMonthName(month)} ${year}</p>
            </div>

            <div class="stats-grid">
                <div class="stat-card">
                    <h4>Total Bills</h4>
                    <div class="stat-value">${result.summary.totalBills}</div>
                </div>
                <div class="stat-card">
                    <h4>Total Amount</h4>
                    <div class="stat-value">₹${result.summary.totalAmount}</div>
                </div>
                <div class="stat-card">
                    <h4>Paid Amount</h4>
                    <div class="stat-value" style="color: var(--success)">₹${result.summary.paidAmount}</div>
                </div>
                <div class="stat-card">
                    <h4>Pending Amount</h4>
                    <div class="stat-value" style="color: var(--danger)">₹${result.summary.pendingAmount}</div>
                </div>
            </div>
            
            <div class="card">
                <div class="flex-between mb-3">
                    <h3>Bill Management</h3>
                    <button class="btn" onclick="showGenerateBillsForm()">Generate Bills</button>
                </div>
                ${result.bills.length > 0 ? `
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Student</th>
                                    <th>College ID</th>
                                    <th>Days</th>
                                    <th>Amount</th>
                                    <th>Status</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${result.bills.map(b => {
                                    const student = b.studentId || {};
                                    return `
                                    <tr>
                                        <td>${student.name || 'Deleted / Unknown Student'}</td>
                                        <td>${student.collegeId || 'N/A'}</td>
                                        <td>${b.totalDays}</td>
                                        <td>₹${b.totalAmount}</td>
                                        <td><span class="badge badge-${b.paymentStatus === 'paid' ? 'success' : 'warning'}">${b.paymentStatus}</span></td>
                                        <td><button class="btn btn-sm" onclick="viewBillDetails('${b._id}')">View</button></td>
                                    </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : '<div class="empty-state"><p>No bills generated for this month</p></div>'}
            </div>
        `;
        
        document.getElementById('content-area').innerHTML = html;
    } catch (error) {
        if (error.name === 'AbortError') throw error;
        showAlert(error.message, 'error');
    }
}

function showGenerateBillsForm() {
    const today = new Date();
    const html = `
        <div class="page-header">
            <h2>💰 Generate Mess Bills</h2>
            <p>Generate bills for all students</p>
        </div>
        
        <div class="card">
            <h3>Bulk Bill Generation</h3>
            <form onsubmit="generateAllBills(event)">
                <div class="form-group">
                    <label>Month</label>
                    <select id="bill-month" required>
                        ${Array.from({length: 12}, (_, i) => `
                            <option value="${i + 1}" ${i + 1 === today.getMonth() + 1 ? 'selected' : ''}>
                                ${getMonthName(i + 1)}
                            </option>
                        `).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Year</label>
                    <input type="number" id="bill-year" required value="${today.getFullYear()}">
                </div>
                <div class="alert alert-info">
                    <p>This will generate bills for all students based on their attendance records.</p>
                    <p>Bills will be calculated as: Total Days × Daily Rate</p>
                </div>
                <div class="flex gap-2">
                    <button type="submit" class="btn">Generate All Bills</button>
                    <button type="button" class="btn btn-secondary" onclick="renderManageBills()">Cancel</button>
                </div>
            </form>
        </div>
    `;
    
    document.getElementById('content-area').innerHTML = html;
}

async function generateAllBills(event) {
    event.preventDefault();
    
    const btn = event.target.querySelector('button[type="submit"]');
    const orig = btn.textContent;
    btn.textContent = 'Generating...';
    btn.disabled = true;

    const data = {
        month: parseInt(document.getElementById('bill-month').value),
        year: parseInt(document.getElementById('bill-year').value)
    };

    try {
        const result = await apiCall('/mess-bill/generate-all', 'POST', data);
        const { total, generated, failed, skipped } = result.summary;
        let title = '';
        if (generated > 0) title = 'Bills generated successfully.';
        else if (generated === 0 && skipped > 0) title = 'No new bills generated. All selected students already have bills.';
        else if (failed > 0) title = 'Some bills could not be generated.';
        else title = 'Bill Generation Complete.';

        const message = `${title}\nTotal Students: ${total}\nNew Bills: ${generated}\nAlready Existing: ${skipped}\nFailed: ${failed}`;
        showAlert(message, failed > 0 ? 'warning' : 'success');
        setTimeout(() => renderManageBills(), 3000);
    } catch (error) {
        if (error.name === 'AbortError') throw error;
        showAlert(error.message, 'error');
    } finally {
        btn.textContent = orig;
        btn.disabled = false;
    }
}

async function renderSetRates() {
    try {
        const result = await apiCall('/mess-rate').catch(() => ({ rates: [] }));
        
        const html = `
            <div class="page-header">
                <h2>💵 Mess Rate Management</h2>
                <p>Configure monthly mess rates</p>
            </div>
            
            <div class="card">
                <h3>Set New Rate</h3>
                <form onsubmit="setMessRate(event)">
                    <div class="form-group">
                        <label>Month</label>
                        <select id="rate-month" required>
                            ${Array.from({length: 12}, (_, i) => `
                                <option value="${i + 1}">${getMonthName(i + 1)}</option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Year</label>
                        <input type="number" id="rate-year" required value="${new Date().getFullYear()}">
                    </div>
                    <div class="form-group">
                        <label>Daily Rate (₹)</label>
                        <input type="number" id="rate-daily" required value="100" min="0">
                    </div>
                    <div class="form-group">
                        <label>Remarks (Optional)</label>
                        <input type="text" id="rate-remarks" placeholder="e.g., Standard rate for the month">
                    </div>
                    <button type="submit" class="btn">Set Rate</button>
                </form>
            </div>

            <div class="card">
                <h3>Rate History</h3>
                ${result.rates.length > 0 ? `
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Month/Year</th>
                                    <th>Daily Rate</th>
                                    <th>Set By</th>
                                    <th>Date</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${result.rates.map(r => `
                                    <tr>
                                        <td><strong>${getMonthName(r.month)} ${r.year}</strong></td>
                                        <td>₹${r.dailyRate}</td>
                                        <td>${r.setBy ? r.setBy.name : 'N/A'}</td>
                                        <td>${formatDate(r.createdAt)}</td>
                                        <td><span class="badge badge-${r.isActive ? 'success' : 'secondary'}">${r.isActive ? 'Active' : 'Inactive'}</span></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : '<div class="empty-state"><p>No rates configured yet</p></div>'}
            </div>
        `;
        
        document.getElementById('content-area').innerHTML = html;
    } catch (error) {
        if (error.name === 'AbortError') throw error;
        showAlert(error.message, 'error');
    }
}

async function setMessRate(event) {
    event.preventDefault();
    
    const data = {
        month: parseInt(document.getElementById('rate-month').value),
        year: parseInt(document.getElementById('rate-year').value),
        dailyRate: parseInt(document.getElementById('rate-daily').value),
        remarks: document.getElementById('rate-remarks').value
    };

    try {
        await apiCall('/mess-rate', 'POST', data);
        showAlert('Mess rate set successfully!', 'success');
        setTimeout(() => renderSetRates(), 1000);
    } catch (error) {
        if (error.name === 'AbortError') throw error;
        showAlert(error.message, 'error');
    }
}

async function renderAllComplaints() {
    try {
        const result = await apiCall('/complaints');
        
        const html = `
            <div class="page-header">
                <h2>🔧 All Complaints</h2>
                <p>Manage and resolve student complaints</p>
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
                <div class="flex-between mb-3">
                    <h3>Complaint List</h3>
                    <div class="flex gap-2">
                        <select onchange="filterComplaintsByStatus(this.value)" style="padding: 8px 16px; border-radius: 8px; border: 2px solid var(--border);">
                            <option value="all">All Status</option>
                            <option value="pending">Pending</option>
                            <option value="in_progress">In Progress</option>
                            <option value="resolved">Resolved</option>
                        </select>
                        <button class="btn btn-secondary btn-sm" onclick="exportTableToCSV('complaintsTable', 'complaints.csv')">
                            📥 Export CSV
                        </button>
                    </div>
                </div>
                ${result.complaints.length > 0 ? `
                    <div class="table-container">
                        <table id="complaintsTable">
                            <thead>
                                <tr>
                                    <th>Ticket ID</th>
                                    <th>Student</th>
                                    <th>Room</th>
                                    <th>Category</th>
                                    <th>Priority</th>
                                    <th>Status</th>
                                    <th>Date</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${result.complaints.map(c => `
                                    <tr data-status="${c.status}">
                                        <td><strong>${c.ticketId}</strong></td>
                                        <td>${c.studentId ? c.studentId.name : 'N/A'}</td>
                                        <td>${c.studentId ? c.studentId.roomNumber : 'N/A'}</td>
                                        <td><span class="badge badge-info">${c.category}</span></td>
                                        <td><span class="badge badge-warning">${c.priority}</span></td>
                                        <td><span class="badge badge-${c.status === 'resolved' ? 'success' : c.status === 'in_progress' ? 'warning' : 'danger'}">${c.status.replace('_', ' ')}</span></td>
                                        <td>${formatDate(c.createdAt)}</td>
                                        <td><button class="btn btn-sm" onclick="manageComplaint('${c._id}')">Manage</button></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : '<div class="empty-state"><p>No complaints found</p></div>'}
            </div>
        `;
        
        document.getElementById('content-area').innerHTML = html;
    } catch (error) {
        if (error.name === 'AbortError') throw error;
        showAlert(error.message, 'error');
    }
}

function filterComplaintsByStatus(status) {
    const rows = document.querySelectorAll('#complaintsTable tbody tr');
    rows.forEach(row => {
        if (status === 'all' || row.dataset.status === status) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

async function manageComplaint(complaintId) {
    try {
        const result = await apiCall(`/complaints/${complaintId}`);
        const complaint = result.complaint;
        
        const modalHtml = `
            <div class="modal active" id="manageComplaintModal" onclick="if(event.target === this) closeModal('manageComplaintModal')">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Manage Complaint - ${complaint.ticketId}</h3>
                        <button class="modal-close" onclick="closeModal('manageComplaintModal')">&times;</button>
                    </div>
                    <div>
                        <p><strong>Student:</strong> ${complaint.studentId?.name || 'Deleted / Unknown'} (${complaint.studentId?.collegeId || 'N/A'})</p>
                        <p><strong>Room:</strong> ${complaint.studentId?.roomNumber || 'N/A'}</p>
                        <p><strong>Phone:</strong> ${complaint.studentId?.phoneNumber || 'N/A'}</p>
                        <p><strong>Category:</strong> <span class="badge badge-info">${complaint.category}</span></p>
                        <p><strong>Priority:</strong> <span class="badge badge-warning">${complaint.priority}</span></p>
                        <p><strong>Current Status:</strong> <span class="badge badge-${complaint.status === 'resolved' ? 'success' : 'warning'}">${complaint.status.replace('_', ' ')}</span></p>
                        <hr style="margin: 20px 0;">
                        <p><strong>Description:</strong></p>
                        <p style="padding: 16px; background: var(--light); border-radius: 8px; margin-bottom: 20px;">${complaint.description}</p>
                        
                        <form onsubmit="updateComplaintStatus(event, '${complaintId}')">
                            <div class="form-group">
                                <label>Update Status</label>
                                <select id="complaint-new-status" required>
                                    <option value="pending" ${complaint.status === 'pending' ? 'selected' : ''}>Pending</option>
                                    <option value="in_progress" ${complaint.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
                                    <option value="resolved" ${complaint.status === 'resolved' ? 'selected' : ''}>Resolved</option>
                                    <option value="rejected">Rejected</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Remarks</label>
                                <textarea id="complaint-remarks" rows="3" placeholder="Add remarks about this update...">${complaint.remarks || ''}</textarea>
                            </div>
                            <div class="form-group">
                                <label>Resolution Notes (if resolved)</label>
                                <textarea id="complaint-resolution" rows="3" placeholder="Describe how the issue was resolved...">${complaint.resolutionNotes || ''}</textarea>
                            </div>
                            <button type="submit" class="btn">Update Complaint</button>
                        </form>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    } catch (error) {
        if (error.name === 'AbortError') throw error;
        showAlert(error.message, 'error');
    }
}

async function updateComplaintStatus(event, complaintId) {
    event.preventDefault();
    
    const data = {
        status: document.getElementById('complaint-new-status').value,
        remarks: document.getElementById('complaint-remarks').value,
        resolutionNotes: document.getElementById('complaint-resolution').value
    };

    try {
        await apiCall(`/complaints/${complaintId}`, 'PUT', data);
        showAlert('Complaint updated successfully!', 'success');
        closeModal('manageComplaintModal');
        renderAllComplaints();
    } catch (error) {
        if (error.name === 'AbortError') throw error;
        showAlert(error.message, 'error');
    }
}


// ==================== ADMIN: WARDEN REQUESTS MANAGEMENT ====================
async function renderWardenRequests() {
    try {
        const result = await apiCall('/warden-requests');
        
        const html = `
            <div class="page-header">
                <h2>🎓 Warden Access Requests</h2>
                <p>Review and approve warden access requests</p>
            </div>
            
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
                    <h3>Requests List</h3>
                    <select onchange="filterWardenRequests(this.value)" style="padding: 8px 16px; border-radius: 8px; border: 2px solid var(--border);">
                        <option value="">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                    </select>
                </div>
                
                ${result.requests.length > 0 ? `
                    <div class="table-container">
                        <table id="wardenRequestsTable">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>College ID</th>
                                    <th>Email</th>
                                    <th>Department</th>
                                    <th>Status</th>
                                    <th>Requested</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${result.requests.map(r => `
                                    <tr data-status="${r.status}">
                                        <td><strong>${r.name}</strong></td>
                                        <td>${r.collegeId}</td>
                                        <td>${r.email}</td>
                                        <td>${r.department || 'N/A'}</td>
                                        <td><span class="badge badge-${r.status === 'approved' ? 'success' : r.status === 'rejected' ? 'danger' : 'warning'}">${r.status}</span></td>
                                        <td>${formatDate(r.requestedAt)}</td>
                                        <td>
                                            ${r.status === 'pending' ? `
                                                <button class="btn btn-success btn-sm" onclick="reviewWardenRequest('${r._id}', 'approve')">Approve</button>
                                                <button class="btn btn-danger btn-sm" onclick="reviewWardenRequest('${r._id}', 'reject')">Reject</button>
                                            ` : `
                                                <button class="btn btn-sm" onclick="viewWardenRequestDetails('${r._id}')">View</button>
                                            `}
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : '<div class="empty-state"><p>No warden requests found</p></div>'}
            </div>
        `;
        
        document.getElementById('content-area').innerHTML = html;
    } catch (error) {
        if (error.name === 'AbortError') throw error;
        showAlert(error.message, 'error');
    }
}

function filterWardenRequests(status) {
    const rows = document.querySelectorAll('#wardenRequestsTable tbody tr');
    rows.forEach(row => {
        if (!status || row.dataset.status === status) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

async function reviewWardenRequest(requestId, action) {
    const actionText = action === 'approve' ? 'approve' : 'reject';
    const notes = prompt(`Enter notes for ${actionText}ing this request (optional):`);
    
    if (notes === null) return; // User cancelled
    
    try {
        showLoading();
        const result = await apiCall(`/warden-requests/${requestId}/${action}`, 'PUT', { notes });
        hideLoading();
        showAlert(result.message, 'success');
        setTimeout(() => renderWardenRequests(), 1000);
    } catch (error) {
        if (error.name === 'AbortError') throw error;
        hideLoading();
        showAlert(error.message, 'error');
    }
}

async function viewWardenRequestDetails(requestId) {
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
                        <div style="margin-bottom: 20px;">
                            <p><strong>Name:</strong> ${request.name}</p>
                            <p><strong>Email:</strong> ${request.email}</p>
                            <p><strong>College ID:</strong> ${request.collegeId}</p>
                            <p><strong>Phone:</strong> ${request.phoneNumber || 'N/A'}</p>
                            <p><strong>Department:</strong> ${request.department || 'N/A'}</p>
                            <p><strong>Room:</strong> ${request.roomNumber || 'N/A'}</p>
                        </div>
                        
                        <hr style="margin: 20px 0;">
                        
                        <div style="margin-bottom: 20px;">
                            <p><strong>Status:</strong> <span class="badge badge-${request.status === 'approved' ? 'success' : request.status === 'rejected' ? 'danger' : 'warning'}">${request.status}</span></p>
                            <p><strong>Requested On:</strong> ${formatDateTime(request.requestedAt)}</p>
                            ${request.reviewedBy ? `
                                <p><strong>Reviewed By:</strong> ${request.reviewedBy.name}</p>
                                <p><strong>Reviewed On:</strong> ${formatDateTime(request.reviewedAt)}</p>
                            ` : ''}
                        </div>
                        
                        ${request.reviewNotes ? `
                            <hr style="margin: 20px 0;">
                            <p><strong>Review Notes:</strong></p>
                            <p style="padding: 16px; background: var(--light); border-radius: 8px;">${request.reviewNotes}</p>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    } catch (error) {
        if (error.name === 'AbortError') throw error;
        showAlert(error.message, 'error');
    }
}

// Make functions globally accessible
window.renderWardenRequests = renderWardenRequests;
window.filterWardenRequests = filterWardenRequests;
window.reviewWardenRequest = reviewWardenRequest;
window.viewWardenRequestDetails = viewWardenRequestDetails;

// Make all warden functions globally accessible
window.renderWardenDashboard = renderWardenDashboard;
window.renderMarkAttendance = renderMarkAttendance;
window.markStudentAttendance = markStudentAttendance;
window.viewTodayAttendance = viewTodayAttendance;
window.renderAttendanceReport = renderAttendanceReport;
window.renderManageBills = renderManageBills;
window.showGenerateBillsForm = showGenerateBillsForm;
window.generateAllBills = generateAllBills;
window.renderSetRates = renderSetRates;
window.setMessRate = setMessRate;
window.renderAllComplaints = renderAllComplaints;
window.filterComplaintsByStatus = filterComplaintsByStatus;
window.manageComplaint = manageComplaint;
window.updateComplaintStatus = updateComplaintStatus;
window.renderAttendanceRecords = renderAttendanceRecords;
window.renderMessBills = renderMessBills;
window.renderComplaints = renderComplaints;

console.log('Warden.js loaded - all functions exposed');


// Placeholder functions for views under development
async function renderAttendanceRecords() {
    try {
        const today = new Date();
        const month = today.getMonth() + 1;
        const year = today.getFullYear();
        
        const result = await apiCall(`/attendance/report?month=${month}&year=${year}`);
        
        const html = `
            <div class="page-header">
                <h2>📅 Attendance Records</h2>
                <p>View historical attendance data for ${getMonthName(month)} ${year}</p>
            </div>
            
            <div class="card">
                <div class="flex-between mb-3">
                    <h3>Monthly Attendance Report</h3>
                    <button class="btn btn-sm" onclick="exportTableToCSV('attendance-table', 'attendance-report.csv')">📥 Export CSV</button>
                </div>
                
                ${result.report && result.report.length > 0 ? `
                    <div class="table-container">
                        <table id="attendance-table">
                            <thead>
                                <tr>
                                    <th>Student Name</th>
                                    <th>College ID</th>
                                    <th>Room</th>
                                    <th>Present Days</th>
                                    <th>Absent Days</th>
                                    <th>Attendance %</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${result.report.map(record => {
                                    const att = record.attendance || {};
                                    const total = (att.present || 0) + (att.absent || 0);
                                    const percentage = total > 0 ? Math.round(((att.present || 0) / total) * 100) : 0;
                                    return `
                                        <tr>
                                            <td><strong>${record.student?.name || 'Unknown'}</strong></td>
                                            <td>${record.student?.collegeId || 'N/A'}</td>
                                            <td>${record.student?.roomNumber || 'N/A'}</td>
                                            <td style="color: var(--success)">${att.present || 0}</td>
                                            <td style="color: var(--danger)">${att.absent || 0}</td>
                                            <td>
                                                <span class="badge ${percentage >= 75 ? 'badge-success' : percentage >= 50 ? 'badge-warning' : 'badge-danger'}">
                                                    ${percentage}%
                                                </span>
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : '<div class="empty-state"><p>No attendance records found for this month</p></div>'}
            </div>
        `;
        
        document.getElementById('content-area').innerHTML = html;
    } catch (error) {
        if (error.name === 'AbortError') throw error;
        showAlert(error.message, 'error');
    }
}

async function renderMessBills() {
    try {
        const today = new Date();
        const month = today.getMonth() + 1;
        const year = today.getFullYear();
        
        const result = await apiCall(`/mess-bill/all?month=${month}&year=${year}`);
        
        const html = `
            <div class="page-header">
                <h2>💰 Mess Bills</h2>
                <p>Manage student mess bills for ${getMonthName(month)} ${year}</p>
            </div>
            
            <div class="stats-grid mb-4">
                <div class="stat-card">
                    <h4>Total Bills</h4>
                    <div class="stat-value">${result.stats ? result.stats.total : 0}</div>
                </div>
                <div class="stat-card">
                    <h4>Total Amount</h4>
                    <div class="stat-value">₹${result.stats ? result.stats.totalAmount : 0}</div>
                </div>
                <div class="stat-card">
                    <h4>Paid</h4>
                    <div class="stat-value" style="color: var(--success)">
                        ${result.stats ? result.stats.paid : 0}
                    </div>
                </div>
                <div class="stat-card">
                    <h4>Pending</h4>
                    <div class="stat-value" style="color: var(--danger)">
                        ${result.stats ? result.stats.pending : 0}
                    </div>
                </div>
            </div>
            
            <div class="card">
                <div class="flex-between mb-3">
                    <h3>All Bills</h3>
                    <div class="flex gap-2">
                        <button class="btn btn-sm" onclick="showGenerateBillsModal()">+ Generate Bills</button>
                        <button class="btn btn-sm" onclick="exportTableToCSV('bills-table', 'mess-bills.csv')">📥 Export CSV</button>
                    </div>
                </div>
                
                ${result.bills && result.bills.length > 0 ? `
                    <div class="table-container">
                        <table id="bills-table">
                            <thead>
                                <tr>
                                    <th>Student Name</th>
                                    <th>College ID</th>
                                    <th>Room</th>
                                    <th>Days</th>
                                    <th>Rate</th>
                                    <th>Amount</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${result.bills.map(bill => `
                                    <tr>
                                        <td><strong>${bill.studentId ? bill.studentId.name : 'N/A'}</strong></td>
                                        <td>${bill.studentId ? bill.studentId.collegeId : 'N/A'}</td>
                                        <td>${bill.studentId ? (bill.studentId.roomNumber || 'N/A') : 'N/A'}</td>
                                        <td>${bill.totalDays}</td>
                                        <td>₹${bill.rate}</td>
                                        <td><strong>₹${bill.totalAmount}</strong></td>
                                        <td>
                                            <span class="badge ${bill.paymentStatus === 'paid' ? 'badge-success' : bill.paymentStatus === 'partial' ? 'badge-warning' : 'badge-danger'}">
                                                ${bill.paymentStatus}
                                            </span>
                                        </td>
                                        <td>
                                            <button class="btn btn-sm" onclick="viewBillDetails('${bill._id}')">View</button>
                                            <button class="btn btn-sm btn-success" onclick="markBillPaid('${bill._id}')">Mark Paid</button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : '<div class="empty-state"><p>No bills generated for this month</p></div>'}
            </div>
        `;
        
        document.getElementById('content-area').innerHTML = html;
    } catch (error) {
        if (error.name === 'AbortError') throw error;
        showAlert(error.message, 'error');
    }
}

async function renderComplaints() {
    try {
        const result = await apiCall('/complaints');
        
        const html = `
            <div class="page-header">
                <h2>🔧 Complaints</h2>
                <p>View and manage student complaints</p>
            </div>
            
            <div class="stats-grid mb-4">
                <div class="stat-card">
                    <h4>Total</h4>
                    <div class="stat-value">${result.stats ? result.stats.total : 0}</div>
                </div>
                <div class="stat-card">
                    <h4>Pending</h4>
                    <div class="stat-value" style="color: var(--warning)">${result.stats ? result.stats.pending : 0}</div>
                </div>
                <div class="stat-card">
                    <h4>In Progress</h4>
                    <div class="stat-value" style="color: var(--info)">${result.stats ? result.stats.inProgress : 0}</div>
                </div>
                <div class="stat-card">
                    <h4>Resolved</h4>
                    <div class="stat-value" style="color: var(--success)">${result.stats ? result.stats.resolved : 0}</div>
                </div>
            </div>
            
            <div class="card">
                <div class="flex-between mb-3">
                    <h3>All Complaints</h3>
                    <div>
                        <select onchange="filterComplaintsByStatus(this.value)" class="form-select">
                            <option value="">All Status</option>
                            <option value="pending">Pending</option>
                            <option value="in_progress">In Progress</option>
                            <option value="resolved">Resolved</option>
                            <option value="rejected">Rejected</option>
                        </select>
                    </div>
                </div>
                
                ${result.complaints && result.complaints.length > 0 ? `
                    <div class="table-container">
                        <table id="complaints-table">
                            <thead>
                                <tr>
                                    <th>Ticket ID</th>
                                    <th>Student</th>
                                    <th>Room</th>
                                    <th>Category</th>
                                    <th>Description</th>
                                    <th>Priority</th>
                                    <th>Status</th>
                                    <th>Date</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${result.complaints.map(complaint => `
                                    <tr>
                                        <td><strong>${complaint.ticketId || 'N/A'}</strong></td>
                                        <td>${complaint.studentId ? complaint.studentId.name : 'N/A'}</td>
                                        <td>${complaint.studentId ? (complaint.studentId.roomNumber || 'N/A') : 'N/A'}</td>
                                        <td><span class="badge badge-info">${complaint.category}</span></td>
                                        <td>${complaint.description ? complaint.description.substring(0, 50) + '...' : 'N/A'}</td>
                                        <td>
                                            <span class="badge ${complaint.priority === 'urgent' ? 'badge-danger' : complaint.priority === 'high' ? 'badge-danger' : complaint.priority === 'medium' ? 'badge-warning' : 'badge-info'}">
                                                ${complaint.priority}
                                            </span>
                                        </td>
                                        <td>
                                            <span class="badge ${complaint.status === 'resolved' ? 'badge-success' : complaint.status === 'in_progress' ? 'badge-info' : complaint.status === 'rejected' ? 'badge-danger' : 'badge-warning'}">
                                                ${complaint.status.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td>${formatDate(complaint.createdAt)}</td>
                                        <td>
                                            <button class="btn btn-sm" onclick="manageComplaint('${complaint._id}')">Manage</button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : '<div class="empty-state"><p>No complaints found</p></div>'}
            </div>
        `;
        
        document.getElementById('content-area').innerHTML = html;
    } catch (error) {
        if (error.name === 'AbortError') throw error;
        showAlert(error.message, 'error');
    }
}


// ==================== MISSING FUNCTIONS ====================

async function showGenerateBillsModal() {
    const today = new Date();
    const html = `
        <div class="page-header">
            <h2>💰 Generate Mess Bills</h2>
            <p>Generate bills for all students</p>
        </div>
        
        <div class="card">
            <h3>Bulk Bill Generation</h3>
            <form onsubmit="generateAllBills(event)">
                <div class="form-group">
                    <label>Month</label>
                    <select id="bill-month" required>
                        ${Array.from({length: 12}, (_, i) => `
                            <option value="${i + 1}" ${i + 1 === today.getMonth() + 1 ? 'selected' : ''}>
                                ${getMonthName(i + 1)}
                            </option>
                        `).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Year</label>
                    <input type="number" id="bill-year" required value="${today.getFullYear()}">
                </div>
                <div class="alert alert-info">
                    <p>This will generate bills for all students based on their attendance records.</p>
                    <p>Bills will be calculated as: Total Days × Daily Rate</p>
                </div>
                <div class="flex gap-2">
                    <button type="submit" class="btn">Generate All Bills</button>
                    <button type="button" class="btn btn-secondary" onclick="renderMessBills()">Cancel</button>
                </div>
            </form>
        </div>
    `;
    
    document.getElementById('content-area').innerHTML = html;
}

async function markBillPaid(billId) {
    if (!confirm('Mark this bill as paid?')) return;
    
    try {
        showLoading();
        await apiCall(`/mess-bill/${billId}/pay`, 'PUT', { paymentStatus: 'paid' });
        hideLoading();
        showAlert('Bill marked as paid successfully!', 'success');
        renderMessBills();
    } catch (error) {
        if (error.name === 'AbortError') throw error;
        hideLoading();
        showAlert(error.message, 'error');
    }
}

// Expose new functions globally
window.showGenerateBillsModal = showGenerateBillsModal;
window.markBillPaid = markBillPaid;
