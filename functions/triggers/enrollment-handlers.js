const {onDocumentCreated} = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');

/**
 * Trigger when enrollment is created
 */
exports.onEnrollmentCreated = onDocumentCreated(
  'businesses/{businessId}/enrollments/{enrollmentId}',
  async (event) => {
    try {
      const enrollment = event.data.data();
      const { businessId } = event.params;
      
      // TODO: Add student to class instances if enrolling in course/template
      console.log('Enrollment created:', {
        businessId,
        studentId: enrollment.studentId,
        type: enrollment.enrollmentType
      });
      
      return null;
    } catch (error) {
      console.error('Error in enrollment trigger:', error);
      return null;
    }
  }
);
