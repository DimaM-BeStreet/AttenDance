const admin = require('firebase-admin');
const { HttpsError } = require('firebase-functions/v2/https');

/**
 * Helper function to validate teacher link token
 */
async function validateTeacherToken(linkToken) {
  if (!linkToken) {
    throw new HttpsError('invalid-argument', 'Link token is required');
  }
  
  const linkDoc = await admin.firestore()
    .collection('teacherLinks')
    .doc(linkToken)
    .get();
  
  if (!linkDoc.exists) {
    throw new HttpsError('not-found', 'Invalid teacher link');
  }
  
  const linkData = linkDoc.data();
  
  // Check expiration if set (currently not used, but ready for future)
  if (linkData.expiresAt && linkData.expiresAt.toDate() < new Date()) {
    throw new HttpsError('permission-denied', 'Teacher link has expired');
  }
  
  // Verify teacher still exists and is active
  const teacherDoc = await admin.firestore()
    .doc(`businesses/${linkData.businessId}/teachers/${linkData.teacherId}`)
    .get();
  
  if (!teacherDoc.exists) {
    throw new HttpsError('not-found', 'Teacher not found');
  }
  
  const teacherData = teacherDoc.data();
  if (teacherData.isActive === false) {
    throw new HttpsError('permission-denied', 'Teacher account is inactive');
  }
  
  return linkData;
}

module.exports = {
  validateTeacherToken
};
