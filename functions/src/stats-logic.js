const admin = require('firebase-admin');
const db = admin.firestore();

/**
 * Calculate and update statistics for a single student
 * @param {string} businessId 
 * @param {string} studentId 
 */
async function updateStudentStats(businessId, studentId) {
  if (!businessId || !studentId) {
    console.error('Missing businessId or studentId for stats update');
    return;
  }

  try {
    // 1. Get class instances where student is enrolled
    // Note: 'array-contains' is efficient enough for this scale
    const instancesSnapshot = await db.collection(`businesses/${businessId}/classInstances`)
      .where('studentIds', 'array-contains', studentId)
      .get();
    
    const instances = instancesSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    // Sort by date (assuming date is a Firestore Timestamp)
    instances.sort((a, b) => {
      const dateA = a.date ? a.date.toMillis() : 0;
      const dateB = b.date ? b.date.toMillis() : 0;
      return dateA - dateB;
    });

    // 2. Get all attendance records for student
    const attendanceSnapshot = await db.collection(`businesses/${businessId}/attendance`)
      .where('studentId', '==', studentId)
      .get();
    
    // Filter for actual attendance (present or late)
    // We exclude 'excused' and 'absent' from statistics
    const attendance = attendanceSnapshot.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(a => ['present', 'late'].includes(a.status));

    attendance.sort((a, b) => {
      const dateA = a.date ? a.date.toMillis() : (a.createdAt ? a.createdAt.toMillis() : 0);
      const dateB = b.date ? b.date.toMillis() : (b.createdAt ? b.createdAt.toMillis() : 0);
      return dateA - dateB;
    });

    // 3. Get active enrollments
    const enrollmentsSnapshot = await db.collection(`businesses/${businessId}/enrollments`)
      .where('studentId', '==', studentId)
      .where('status', '==', 'active')
      .get();

    // 4. Calculate Stats
    const stats = {
      totalClasses: instances.length,
      activeEnrollments: enrollmentsSnapshot.size,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    };

    // First Class Info
    if (instances.length > 0) {
      const firstClass = instances[0];
      stats.firstClassId = firstClass.id;
      stats.firstClassDate = firstClass.date || null;
      stats.firstClassBranchId = firstClass.branchId || null;
      stats.firstClassTeacherId = firstClass.teacherId || null;
      
      // Check if attended first class
      const attendedFirst = attendance.some(a => a.classInstanceId === firstClass.id);
      stats.firstClassAttended = attendedFirst;
    } else {
      stats.firstClassId = null;
      stats.firstClassDate = null;
      stats.firstClassBranchId = null;
      stats.firstClassTeacherId = null;
      stats.firstClassAttended = false;
    }

    // First Attendance Info
    if (attendance.length > 0) {
      const firstAtt = attendance[0];
      stats.firstAttendanceId = firstAtt.id;
      stats.firstAttendanceDate = firstAtt.date || firstAtt.createdAt || null;
      stats.firstAttendanceClassId = firstAtt.classInstanceId;
      
      // We need branchId for the attendance. It's on the class instance.
      // If we already fetched instances, check if we have it.
      let attClass = instances.find(i => i.id === firstAtt.classInstanceId);
      
      // If not found in student's current instances (maybe removed from class?), fetch it directly
      if (!attClass && firstAtt.classInstanceId) {
        try {
          const classDoc = await db.collection(`businesses/${businessId}/classInstances`).doc(firstAtt.classInstanceId).get();
          if (classDoc.exists) {
            attClass = classDoc.data();
          }
        } catch (err) {
          console.warn(`Error fetching class instance ${firstAtt.classInstanceId} for student ${studentId}:`, err);
        }
      }

      if (attClass) {
        stats.firstAttendanceBranchId = attClass.branchId || null;
        stats.firstAttendanceTeacherId = attClass.teacherId || null;
      } else {
        stats.firstAttendanceBranchId = null;
        stats.firstAttendanceTeacherId = null;
      }
    } else {
      stats.firstAttendanceId = null;
      stats.firstAttendanceDate = null;
      stats.firstAttendanceBranchId = null;
      stats.firstAttendanceTeacherId = null;
    }

    // Update Student Document
    await db.collection(`businesses/${businessId}/students`).doc(studentId).update({
      stats: stats
    });

    console.log(`Updated stats for student ${studentId}`);
    return stats;

  } catch (error) {
    console.error(`Error updating stats for student ${studentId}:`, error);
    throw error;
  }
}

module.exports = {
  updateStudentStats
};
