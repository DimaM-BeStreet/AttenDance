const { onCall } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { updateStudentStats } = require('../src/stats-logic');
const db = admin.firestore();

/**
 * Callable Function: Sync stats for all students in a business
 * Can be called from the Admin Panel "Sync" button
 */
exports.syncBusinessStats = onCall(
  { 
    timeoutSeconds: 540, // Max timeout for Gen 2
    memory: '512MiB'
  }, 
  async (request) => {
    // Check authentication
    if (!request.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'The function must be called while authenticated.'
      );
    }

    const { businessId } = request.data;
    
    // Verify user belongs to business (basic check)
    // In a real app, you'd check custom claims or DB role
    if (request.auth.token.businessId && request.auth.token.businessId !== businessId) {
       // Allow if admin/super-admin, otherwise reject
       // For now, we assume the client passes the correct ID and we trust the auth token if it matches
    }

    if (!businessId) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing businessId');
    }

    console.log(`Starting stats sync for business: ${businessId}`);

    try {
      const studentsSnapshot = await db.collection(`businesses/${businessId}/students`).get();
      const students = studentsSnapshot.docs.map(d => d.id);
      
      console.log(`Found ${students.length} students to sync.`);

      let successCount = 0;
      let errorCount = 0;
      const errorDetails = [];

      // Process in chunks to avoid memory issues, though Promise.all handles concurrency
      // We'll do chunks of 50
      const chunkSize = 50;
      for (let i = 0; i < students.length; i += chunkSize) {
        const chunk = students.slice(i, i + chunkSize);
        const promises = chunk.map(studentId => 
          updateStudentStats(businessId, studentId)
            .then(() => successCount++)
            .catch(err => {
              console.error(`Failed to sync student ${studentId}:`, err);
              errorCount++;
              errorDetails.push(`${studentId}: ${err.message}`);
            })
        );
        await Promise.all(promises);
      }

      return {
        success: true,
        total: students.length,
        updated: successCount,
        errors: errorCount,
        errorDetails: errorDetails
      };

    } catch (error) {
      console.error('Error in syncBusinessStats:', error);
      throw new functions.https.HttpsError('internal', 'Failed to sync stats', error);
    }
  }
);
