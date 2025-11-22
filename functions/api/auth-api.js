const {onCall, HttpsError} = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

/**
 * Authentication API endpoints
 */

/**
 * Validate teacher access link
 */
exports.validateTeacherLink = onCall(async (request) => {
  try {
    const { linkToken } = request.data;
    
    if (!linkToken) {
      throw new HttpsError('invalid-argument', 'Link token is required');
    }
    
    // Get teacher link from Firestore
    const linkDoc = await admin.firestore()
      .collection('teacherLinks')
      .doc(linkToken)
      .get();
    
    if (!linkDoc.exists) {
      throw new HttpsError('not-found', 'Invalid teacher link');
    }
    
    const linkData = linkDoc.data();
    
    // Update last accessed time
    await linkDoc.ref.update({
      lastAccessed: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Get teacher data
    const teacherDoc = await admin.firestore()
      .doc(`businesses/${linkData.businessId}/teachers/${linkData.teacherId}`)
      .get();
    
    if (!teacherDoc.exists) {
      throw new HttpsError('not-found', 'Teacher not found');
    }
    
    return {
      success: true,
      teacherId: linkData.teacherId,
      businessId: linkData.businessId,
      teacherData: teacherDoc.data()
    };
  } catch (error) {
    console.error('Error validating teacher link:', error);
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Generate teacher access link
 */
exports.generateTeacherLink = onCall(async (request) => {
  try {
    // Check authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }
    
    const { teacherId, businessId } = request.data;
    
    if (!teacherId || !businessId) {
      throw new HttpsError('invalid-argument', 'Teacher ID and Business ID are required');
    }
    
    // Verify user has permission (must be manager of this business or superAdmin)
    const userDoc = await admin.firestore()
      .collection('users')
      .doc(request.auth.uid)
      .get();
    
    if (!userDoc.exists) {
      throw new HttpsError('not-found', 'User not found');
    }
    
    const userData = userDoc.data();
    
    const isAuthorized = userData.role === 'superAdmin' || 
                         (userData.role === 'admin' && userData.businessId === businessId);
    
    if (!isAuthorized) {
      console.error('Authorization failed:', {
        userRole: userData.role,
        userBusinessId: userData.businessId,
        requestedBusinessId: businessId
      });
      throw new HttpsError('permission-denied', 'Not authorized');
    }
    
    // Generate unique token
    const crypto = require('crypto');
    const linkToken = crypto.randomBytes(32).toString('hex');
    
    // Save link to Firestore
    await admin.firestore()
      .collection('teacherLinks')
      .doc(linkToken)
      .set({
        teacherId,
        businessId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastAccessed: null
      });
    
    // Update teacher document with link
    await admin.firestore()
      .doc(`businesses/${businessId}/teachers/${teacherId}`)
      .update({
        uniqueLink: linkToken
      });
    
    return {
      linkToken,
      url: `https://attendance-6e07e.web.app/teacher?link=${linkToken}`
    };
  } catch (error) {
    console.error('Error generating teacher link:', error);
    throw new HttpsError('internal', error.message);
  }
});
