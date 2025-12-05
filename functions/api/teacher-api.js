const {onCall, HttpsError} = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { validateTeacherToken } = require('../src/auth-helpers');

/**
 * Teacher API endpoints - secure write operations
 */

/**
 * Create a temporary student
 */
exports.createTempStudent = onCall(async (request) => {
  try {
    const { linkToken, studentData } = request.data;
    
    // Validate teacher
    const linkData = await validateTeacherToken(linkToken);
    
    // Verify teacher has access to this business
    if (linkData.businessId !== studentData.businessId) {
      throw new HttpsError('permission-denied', 'Teacher does not have access to this business');
    }
    
    // Create temp student
    const tempStudentRef = admin.firestore().collection('tempStudents').doc();
    
    const tempStudent = {
      ...studentData,
      createdBy: linkData.teacherId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      active: true,
      type: 'temp'
    };
    
    await tempStudentRef.set(tempStudent);
    
    return { 
      success: true, 
      studentId: tempStudentRef.id,
      student: { id: tempStudentRef.id, ...studentData }
    };
  } catch (error) {
    console.error('Error creating temp student:', error);
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Create validated teacher session
 * Maps anonymous Firebase Auth UID to validated teacher
 */
exports.createTeacherSession = onCall(async (request) => {
  try {
    const { linkToken, uid } = request.data;
    
    if (!uid) {
      throw new HttpsError('invalid-argument', 'UID is required');
    }
    
    // Validate teacher link
    const linkData = await validateTeacherToken(linkToken);
    
    // Create/update session document mapping UID to validated teacher
    // Session expires after 90 days (renewed on each login)
    await admin.firestore()
      .collection('teacherSessions')
      .doc(uid)
      .set({
        teacherId: linkData.teacherId,
        businessId: linkData.businessId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastAccessedAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days
      });
    
    return { success: true };
  } catch (error) {
    console.error('Error creating teacher session:', error);
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Renew teacher session (extends expiration)
 */
exports.renewTeacherSession = onCall(async (request) => {
  try {
    const { linkToken, uid } = request.data;
    
    if (!uid) {
      throw new HttpsError('invalid-argument', 'UID is required');
    }
    
    // Validate teacher link
    const linkData = await validateTeacherToken(linkToken);
    
    // Update session expiration
    await admin.firestore()
      .collection('teacherSessions')
      .doc(uid)
      .update({
        lastAccessedAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // Extend by 90 days
      });
    
    return { success: true };
  } catch (error) {
    console.error('Error renewing teacher session:', error);
    throw new HttpsError('internal', error.message);
  }
});

module.exports = {
  markAttendance: exports.markAttendance,
  createTempStudent: exports.createTempStudent,
  createTeacherSession: exports.createTeacherSession,
  renewTeacherSession: exports.renewTeacherSession
};
