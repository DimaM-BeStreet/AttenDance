const {onDocumentCreated} = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');

/**
 * Trigger when attendance is created - can send notifications to parents
 */
exports.onAttendanceCreated = onDocumentCreated(
  'businesses/{businessId}/attendance/{attendanceId}',
  async (event) => {
    try {
      const attendance = event.data.data();
      const { businessId } = event.params;
      
      // TODO: Implement notification logic
      // - Get student data
      // - Get parent contact info
      // - Send notification (FCM or SMS)
      
      console.log('Attendance created:', {
        businessId,
        studentId: attendance.studentId,
        status: attendance.status
      });
      
      return null;
    } catch (error) {
      console.error('Error in attendance trigger:', error);
      return null;
    }
  }
);
