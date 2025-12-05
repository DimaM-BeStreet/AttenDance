const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { updateStudentStats } = require('../src/stats-logic');

/**
 * Trigger: When Attendance is created, updated, or deleted
 * Update stats for the relevant student
 */
exports.onAttendanceWritten = onDocumentWritten(
  'businesses/{businessId}/attendance/{attendanceId}',
  async (event) => {
    const { businessId } = event.params;
    const newData = event.data?.after?.data();
    const oldData = event.data?.before?.data();

    const studentId = newData?.studentId || oldData?.studentId;

    if (studentId) {
      await updateStudentStats(businessId, studentId);
    }
  }
);

/**
 * Trigger: When Enrollment is created, updated, or deleted
 * Update stats for the relevant student
 */
exports.onEnrollmentWritten = onDocumentWritten(
  'businesses/{businessId}/enrollments/{enrollmentId}',
  async (event) => {
    const { businessId } = event.params;
    const newData = event.data?.after?.data();
    const oldData = event.data?.before?.data();

    const studentId = newData?.studentId || oldData?.studentId;

    if (studentId) {
      await updateStudentStats(businessId, studentId);
    }
  }
);

/**
 * Trigger: When Class Instance is created, updated, or deleted
 * Check for changes in studentIds and update stats for affected students
 */
exports.onClassInstanceWritten = onDocumentWritten(
  'businesses/{businessId}/classInstances/{instanceId}',
  async (event) => {
    const { businessId } = event.params;
    const newData = event.data?.after?.data();
    const oldData = event.data?.before?.data();

    const newStudents = newData?.studentIds || [];
    const oldStudents = oldData?.studentIds || [];

    // Find all affected students (added or removed)
    const affectedStudents = new Set([
      ...newStudents.filter(id => !oldStudents.includes(id)), // Added
      ...oldStudents.filter(id => !newStudents.includes(id))  // Removed
    ]);

    // Also if the date changed, we might need to re-sort for everyone (expensive but correct)
    // For now, let's stick to membership changes to avoid massive fan-out
    
    const promises = Array.from(affectedStudents).map(studentId => 
      updateStudentStats(businessId, studentId)
    );

    await Promise.all(promises);
  }
);
