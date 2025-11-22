const {onCall, HttpsError} = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

/**
 * Teacher API endpoints - secure write operations
 */

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

/**
 * Mark attendance for a student in a class instance
 */
exports.markAttendance = onCall(async (request) => {
  try {
    const { linkToken, classInstanceId, studentId, businessId, status, notes } = request.data;
    
    // Validate required fields
    if (!classInstanceId || !studentId || !businessId || !status) {
      throw new HttpsError('invalid-argument', 'Missing required fields');
    }
    
    // Validate teacher
    const linkData = await validateTeacherToken(linkToken);
    
    // Verify this teacher belongs to the business
    if (linkData.businessId !== businessId) {
      throw new HttpsError('permission-denied', 'Teacher does not have access to this business');
    }
    
    // Create or update attendance record
    const attendanceRef = admin.firestore()
      .collection('businesses')
      .doc(businessId)
      .collection('attendance')
      .doc(`${classInstanceId}_${studentId}`);
    
    const attendanceData = {
      classInstanceId,
      studentId,
      status,
      notes: notes || '',
      markedBy: linkData.teacherId,
      markedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    // Use set to overwrite any existing record with this exact document ID
    await attendanceRef.set(attendanceData, { merge: true });
    
    return { success: true };
  } catch (error) {
    console.error('Error marking attendance:', error);
    throw new HttpsError('internal', error.message);
  }
});

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
