const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { validateTeacherToken } = require('../src/auth-helpers');

/**
 * Unified Attendance API
 * Handles attendance marking for both Teachers (via Link Token) and Admins (via Auth)
 */
exports.markAttendance = onCall(async (request) => {
  try {
    const { 
      linkToken, 
      classInstanceId, 
      studentId, 
      businessId, 
      status, 
      notes 
    } = request.data;
    
    // Validate required fields
    if (!classInstanceId || !studentId || !businessId || !status) {
      throw new HttpsError('invalid-argument', 'Missing required fields');
    }

    let markedBy = null;
    let markedByType = null; // 'teacher' or 'admin'

    // 1. Check if request is from an Authenticated User (Admin/Manager)
    if (request.auth) {
      markedBy = request.auth.uid;
      markedByType = 'admin';
    } 
    // 2. Check if request is from a Teacher (via Link Token)
    else if (linkToken) {
      const linkData = await validateTeacherToken(linkToken);
      
      if (linkData.businessId !== businessId) {
        throw new HttpsError('permission-denied', 'Teacher does not have access to this business');
      }
      
      markedBy = linkData.teacherId;
      markedByType = 'teacher';
    } 
    // 3. Unauthorized
    else {
      throw new HttpsError('unauthenticated', 'Must be logged in or provide a teacher link token');
    }
    
    const attendanceRef = admin.firestore()
      .collection('businesses')
      .doc(businessId)
      .collection('attendance')
      .doc(`${classInstanceId}_${studentId}`);

    // Handle Deletion (status === 'none')
    if (status === 'none') {
      await attendanceRef.delete();
      return { success: true, action: 'deleted' };
    }

    // Handle Create/Update
    const attendanceData = {
      classInstanceId,
      studentId,
      status,
      notes: notes || '',
      markedBy: markedBy,
      markedByType: markedByType,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // Check if exists to set createdAt only on creation
    const docSnap = await attendanceRef.get();
    if (!docSnap.exists) {
      attendanceData.createdAt = admin.firestore.FieldValue.serverTimestamp();
    }
    
    await attendanceRef.set(attendanceData, { merge: true });
    
    return { success: true };
  } catch (error) {
    console.error('Error marking attendance:', error);
    throw new HttpsError('internal', error.message);
  }
});
