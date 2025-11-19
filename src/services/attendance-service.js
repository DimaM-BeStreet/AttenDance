import { db } from '@config/firebase-config';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc,
  query, 
  where, 
  orderBy,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';

/**
 * Attendance Service
 * Handles attendance marking and tracking for class instances
 */

/**
 * Mark attendance for a student in a class instance
 */
export async function markAttendance(businessId, attendanceData) {
  try {
    const attendanceRef = collection(db, `studios/${businessId}/attendance`);
    
    // Check if attendance already exists
    const existingQuery = query(
      attendanceRef,
      where('studentId', '==', attendanceData.studentId),
      where('classInstanceId', '==', attendanceData.classInstanceId)
    );
    
    const existingSnapshot = await getDocs(existingQuery);
    
    if (!existingSnapshot.empty) {
      // Update existing attendance
      const existingDoc = existingSnapshot.docs[0];
      await updateDoc(existingDoc.ref, {
        status: attendanceData.status,
        notes: attendanceData.notes || '',
        updatedAt: serverTimestamp()
      });
      
      return {
        id: existingDoc.id,
        ...existingDoc.data(),
        status: attendanceData.status
      };
    } else {
      // Create new attendance record
      const newAttendance = {
        studentId: attendanceData.studentId,
        classInstanceId: attendanceData.classInstanceId,
        date: attendanceData.date instanceof Date ? Timestamp.fromDate(attendanceData.date) : attendanceData.date,
        status: attendanceData.status, // present, absent, late, excused
        notes: attendanceData.notes || '',
        markedBy: attendanceData.markedBy || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(attendanceRef, newAttendance);

      return {
        id: docRef.id,
        ...newAttendance
      };
    }
  } catch (error) {
    console.error('Error marking attendance:', error);
    throw error;
  }
}

/**
 * Bulk mark attendance for multiple students
 */
export async function bulkMarkAttendance(businessId, classInstanceId, attendanceRecords) {
  try {
    const results = await Promise.all(
      attendanceRecords.map(record => 
        markAttendance(businessId, {
          ...record,
          classInstanceId
        })
      )
    );

    return results;
  } catch (error) {
    console.error('Error bulk marking attendance:', error);
    throw error;
  }
}

/**
 * Get attendance for a class instance
 */
export async function getClassInstanceAttendance(businessId, classInstanceId) {
  try {
    const attendanceRef = collection(db, `studios/${businessId}/attendance`);
    const q = query(
      attendanceRef,
      where('classInstanceId', '==', classInstanceId)
    );
    
    const snapshot = await getDocs(q);
    const attendance = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Enrich with student info
    const enrichedAttendance = await Promise.all(
      attendance.map(async (record) => {
        const studentDoc = await getDoc(doc(db, `studios/${businessId}/students`, record.studentId));
        if (studentDoc.exists()) {
          const student = studentDoc.data();
          return {
            ...record,
            studentName: `${student.firstName} ${student.lastName}`,
            studentPhone: student.phone,
            studentPhoto: student.photoURL
          };
        }
        return record;
      })
    );

    return enrichedAttendance;
  } catch (error) {
    console.error('Error getting class instance attendance:', error);
    throw error;
  }
}

/**
 * Get attendance records for a student
 */
export async function getStudentAttendanceHistory(businessId, studentId, options = {}) {
  try {
    const attendanceRef = collection(db, `studios/${businessId}/attendance`);
    let q = query(attendanceRef, where('studentId', '==', studentId));

    if (options.startDate) {
      const start = options.startDate instanceof Date ? Timestamp.fromDate(options.startDate) : options.startDate;
      q = query(q, where('date', '>=', start));
    }

    if (options.endDate) {
      const end = options.endDate instanceof Date ? Timestamp.fromDate(options.endDate) : options.endDate;
      q = query(q, where('date', '<=', end));
    }

    q = query(q, orderBy('date', 'desc'));

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting student attendance history:', error);
    throw error;
  }
}

/**
 * Calculate attendance statistics for a student
 */
export async function calculateStudentAttendanceStats(businessId, studentId, options = {}) {
  try {
    const attendanceRecords = await getStudentAttendanceHistory(businessId, studentId, options);
    
    const stats = {
      total: attendanceRecords.length,
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
      attendanceRate: 0,
      punctualityRate: 0
    };

    attendanceRecords.forEach(record => {
      if (stats[record.status] !== undefined) {
        stats[record.status]++;
      }
    });

    if (stats.total > 0) {
      stats.attendanceRate = (((stats.present + stats.late) / stats.total) * 100).toFixed(1);
      stats.punctualityRate = ((stats.present / stats.total) * 100).toFixed(1);
    }

    return stats;
  } catch (error) {
    console.error('Error calculating student attendance stats:', error);
    throw error;
  }
}

/**
 * Get attendance statistics for a class instance
 */
export async function calculateClassAttendanceStats(businessId, classInstanceId) {
  try {
    const attendance = await getClassInstanceAttendance(businessId, classInstanceId);
    
    const stats = {
      total: attendance.length,
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
      notMarked: 0
    };

    attendance.forEach(record => {
      if (stats[record.status] !== undefined) {
        stats[record.status]++;
      }
    });

    stats.attendanceRate = stats.total > 0 
      ? (((stats.present + stats.late) / stats.total) * 100).toFixed(1)
      : 0;

    return stats;
  } catch (error) {
    console.error('Error calculating class attendance stats:', error);
    throw error;
  }
}

/**
 * Get overall business attendance statistics
 */
export async function getBusinessAttendanceStats(businessId, options = {}) {
  try {
    const attendanceRef = collection(db, `studios/${businessId}/attendance`);
    let q = attendanceRef;

    if (options.startDate) {
      const start = options.startDate instanceof Date ? Timestamp.fromDate(options.startDate) : options.startDate;
      q = query(q, where('date', '>=', start));
    }

    if (options.endDate) {
      const end = options.endDate instanceof Date ? Timestamp.fromDate(options.endDate) : options.endDate;
      q = query(q, where('date', '<=', end));
    }

    const snapshot = await getDocs(q);
    const records = snapshot.docs.map(doc => doc.data());
    
    const stats = {
      total: records.length,
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
      attendanceRate: 0
    };

    records.forEach(record => {
      if (stats[record.status] !== undefined) {
        stats[record.status]++;
      }
    });

    if (stats.total > 0) {
      stats.attendanceRate = (((stats.present + stats.late) / stats.total) * 100).toFixed(1);
    }

    return stats;
  } catch (error) {
    console.error('Error getting business attendance stats:', error);
    throw error;
  }
}

/**
 * Get recent attendance records
 */
export async function getRecentAttendance(businessId, limit = 20) {
  try {
    const attendanceRef = collection(db, `studios/${businessId}/attendance`);
    const q = query(
      attendanceRef,
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    const records = snapshot.docs.slice(0, limit).map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Enrich with student info
    const enrichedRecords = await Promise.all(
      records.map(async (record) => {
        const studentDoc = await getDoc(doc(db, `studios/${businessId}/students`, record.studentId));
        if (studentDoc.exists()) {
          const student = studentDoc.data();
          record.studentName = `${student.firstName} ${student.lastName}`;
        }
        return record;
      })
    );

    return enrichedRecords;
  } catch (error) {
    console.error('Error getting recent attendance:', error);
    throw error;
  }
}

/**
 * Get students with low attendance rate
 */
export async function getStudentsWithLowAttendance(businessId, threshold = 70) {
  try {
    // Get all students
    const studentsRef = collection(db, `studios/${businessId}/students`);
    const studentsSnapshot = await getDocs(query(studentsRef, where('isActive', '==', true)));
    const students = studentsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Calculate attendance for each student
    const studentsWithStats = await Promise.all(
      students.map(async (student) => {
        const stats = await calculateStudentAttendanceStats(businessId, student.id);
        return {
          ...student,
          attendanceStats: stats
        };
      })
    );

    // Filter students below threshold
    return studentsWithStats.filter(student => 
      parseFloat(student.attendanceStats.attendanceRate) < threshold &&
      student.attendanceStats.total > 0
    );
  } catch (error) {
    console.error('Error getting students with low attendance:', error);
    throw error;
  }
}

/**
 * Get attendance trend data for charts
 */
export async function getAttendanceTrendData(businessId, days = 30) {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const attendanceRef = collection(db, `studios/${businessId}/attendance`);
    const q = query(
      attendanceRef,
      where('date', '>=', Timestamp.fromDate(startDate)),
      where('date', '<=', Timestamp.fromDate(endDate)),
      orderBy('date', 'asc')
    );

    const snapshot = await getDocs(q);
    const records = snapshot.docs.map(doc => doc.data());

    // Group by date
    const dailyStats = {};
    records.forEach(record => {
      const dateKey = record.date.toDate().toISOString().split('T')[0];
      if (!dailyStats[dateKey]) {
        dailyStats[dateKey] = { present: 0, absent: 0, late: 0, excused: 0, total: 0 };
      }
      dailyStats[dateKey][record.status]++;
      dailyStats[dateKey].total++;
    });

    // Convert to array format for charts
    return Object.entries(dailyStats).map(([date, stats]) => ({
      date,
      ...stats,
      attendanceRate: ((stats.present + stats.late) / stats.total * 100).toFixed(1)
    }));
  } catch (error) {
    console.error('Error getting attendance trend data:', error);
    throw error;
  }
}
