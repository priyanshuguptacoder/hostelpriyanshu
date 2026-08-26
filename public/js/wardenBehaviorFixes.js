(() => {
  async function markStudentAttendanceFixed(event) {
    event.preventDefault();

    const identifier = document.getElementById('att-student-identifier')?.value.trim();
    const date = document.getElementById('att-date')?.value;
    const status = document.getElementById('att-status')?.value;
    const remarks = document.getElementById('att-remarks')?.value.trim();

    if (!identifier || !date || !status) {
      window.showAlert?.('Student, date, and attendance status are required.', 'error');
      return false;
    }

    try {
      window.showLoading?.();
      const searchResult = await window.apiCall(`/attendance/students?search=${encodeURIComponent(identifier)}`);
      const student = searchResult.data?.find(user =>
        user.collegeId?.toLowerCase() === identifier.toLowerCase() ||
        user.email?.toLowerCase() === identifier.toLowerCase() ||
        user.roomNumber?.toLowerCase() === identifier.toLowerCase() ||
        user.name?.toLowerCase() === identifier.toLowerCase()
      ) || searchResult.data?.[0];

      if (!student) {
        window.showAlert?.('No student found. Check the College ID or email and try again.', 'error');
        return false;
      }

      await window.apiCall('/attendance/mark', 'POST', {
        studentId: student._id,
        date,
        status,
        remarks
      });

      window.showAlert?.(`Attendance marked successfully for ${student.name}.`, 'success');
      document.getElementById('att-student-identifier').value = '';
      document.getElementById('att-remarks').value = '';
    } catch (error) {
      console.error('Warden attendance error:', error);
      window.showAlert?.(error.message || 'Unable to mark attendance.', 'error');
    } finally {
      window.hideLoading?.();
    }

    return false;
  }

  window.markStudentAttendance = markStudentAttendanceFixed;
})();
