import { db } from '@config/firebase-config';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  query, 
  where, 
  orderBy,
  writeBatch
} from 'firebase/firestore';

/**
 * Student Stats Service
 * Handles calculation and synchronization of student statistics for reports
 */

/**
 * Calculate stats for a single student
 * @param {string} businessId 
 * @param {string} studentId 
 */
export async function calculateStudentStats(businessId, studentId) {
  try {
    // 1. Get all class instances where student is enrolled
    // Note: This requires scanning all instances or having a reverse index.
    // Firestore doesn't support array-contains-any efficiently for "all instances".
    // But we can query instances where studentIds array-contains studentId.
    // This might be slow if there are many instances.
    // Optimization: Limit to recent instances or use a dedicated collection if scale is huge.
    // For now, we'll query all instances.
    
    const instancesRef = collection(db, `businesses/${businessId}/classInstances`);
    const instancesQuery = query(instancesRef, where('studentIds', 'array-contains', studentId));
    const instancesSnapshot = await getDocs(instancesQuery);
    const instances = instancesSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    
    // Sort by date
    instances.sort((a, b) => a.date.seconds - b.date.seconds);
    
    // 2. Get all attendance records for student
    const attendanceRef = collection(db, `businesses/${businessId}/attendance`);
    const attendanceQuery = query(attendanceRef, where('studentId', '==', studentId));
    const attendanceSnapshot = await getDocs(attendanceQuery);
    const attendance = attendanceSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    
    // Sort by date
    attendance.sort((a, b) => a.date.seconds - b.date.seconds);
    
    // 3. Get active enrollments
    const enrollmentsRef = collection(db, `businesses/${businessId}/enrollments`);
    const enrollmentsQuery = query(
      enrollmentsRef, 
      where('studentId', '==', studentId),
      where('isActive', '==', true)
    );
    const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
    
    // 4. Calculate Stats
    const stats = {
      totalClasses: instances.length,
      activeEnrollments: enrollmentsSnapshot.size,
      lastUpdated: new Date()
    };
    
    // First Class Info
    if (instances.length > 0) {
      const firstClass = instances[0];
      stats.firstClassId = firstClass.id;
      stats.firstClassDate = firstClass.date;
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
      stats.firstAttendanceDate = firstAtt.date;
      stats.firstAttendanceClassId = firstAtt.classInstanceId;
      
      // We need branchId for the attendance. It's on the class instance.
      // If we already fetched instances, check if we have it.
      const attClass = instances.find(i => i.id === firstAtt.classInstanceId);
      if (attClass) {
        stats.firstAttendanceBranchId = attClass.branchId || null;
        stats.firstAttendanceTeacherId = attClass.teacherId || null;
      } else {
        // Fetch specific class if not in list (e.g. student removed from class but attendance remains)
        const classDoc = await getDoc(doc(db, `businesses/${businessId}/classInstances`, firstAtt.classInstanceId));
        if (classDoc.exists()) {
          const data = classDoc.data();
          stats.firstAttendanceBranchId = data.branchId || null;
          stats.firstAttendanceTeacherId = data.teacherId || null;
        }
      }
    } else {
      stats.firstAttendanceId = null;
      stats.firstAttendanceDate = null;
      stats.firstAttendanceBranchId = null;
      stats.firstAttendanceTeacherId = null;
    }
    
    return stats;
  } catch (error) {
    console.error(`Error calculating stats for student ${studentId}:`, error);
    return null;
  }
}

/**
 * Sync stats for a batch of students
 */
export async function syncStudentStatsBatch(businessId, students) {
  const batch = writeBatch(db);
  let updateCount = 0;
  
  for (const student of students) {
    const stats = await calculateStudentStats(businessId, student.id);
    if (stats) {
      const studentRef = doc(db, `businesses/${businessId}/students`, student.id);
      batch.update(studentRef, { stats });
      updateCount++;
    }
  }
  
  if (updateCount > 0) {
    await batch.commit();
  }
  
  return updateCount;
}

/**
 * Get report data based on pre-calculated stats
 */
export async function getReportData(businessId, type, filters = {}) {
  const studentsRef = collection(db, `businesses/${businessId}/students`);
  let constraints = [];
  
  // Base query based on report type
  switch (type) {
    case 'first_class_no_attendance':
      // Students with a first class but not attended it
      constraints.push(where('stats.firstClassAttended', '==', false));
      // We also need to ensure they HAVE a first class
      // Firestore doesn't support "where field != null" easily combined with other filters sometimes
      // But we can filter results client side if needed, or rely on the boolean check
      break;
      
    case 'first_attendance_no_course':
      // Students with attendance but no active enrollments
      constraints.push(where('stats.activeEnrollments', '==', 0));
      // And must have attended at least once
      // constraints.push(where('stats.firstAttendanceDate', '!=', null)); // Requires index
      break;
      
    case 'active_no_class':
      // Active students with 0 classes AND 0 active enrollments
      constraints.push(where('isActive', '==', true));
      constraints.push(where('stats.totalClasses', '==', 0));
      constraints.push(where('stats.activeEnrollments', '==', 0));
      break;
  }
  
  // Execute Query
  const q = query(studentsRef, ...constraints);
  const snapshot = await getDocs(q);
  let students = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  
  // Apply additional filters in memory (more flexible than composite indexes)
  return students.filter(student => {
    const stats = student.stats || {};
    
    // Filter logic per report type
    if (type === 'first_class_no_attendance') {
      if (!stats.firstClassDate) return false;
      
      // Date Filter
      if (filters.startDate && stats.firstClassDate.seconds < filters.startDate.getTime() / 1000) return false;
      if (filters.endDate && stats.firstClassDate.seconds > filters.endDate.getTime() / 1000) return false;
      
      // Branch Filter
      if (filters.branchId && stats.firstClassBranchId !== filters.branchId) return false;
      
      // Teacher Filter
      if (filters.teacherId && stats.firstClassTeacherId !== filters.teacherId) return false;
    }
    
    if (type === 'first_attendance_no_course') {
      if (!stats.firstAttendanceDate) return false;
      
      // Date Filter
      if (filters.startDate && stats.firstAttendanceDate.seconds < filters.startDate.getTime() / 1000) return false;
      if (filters.endDate && stats.firstAttendanceDate.seconds > filters.endDate.getTime() / 1000) return false;
      
      // Branch Filter
      if (filters.branchId && stats.firstAttendanceBranchId !== filters.branchId) return false;
      
      // Teacher Filter
      if (filters.teacherId && stats.firstAttendanceTeacherId !== filters.teacherId) return false;
    }
    
    // active_no_class usually doesn't have date/branch filters in the same way
    // because "no class" means no date/branch to filter by.
    // Unless we mean "Active students belonging to branch X".
    // But students don't always have a home branch.
    // If the user wants to filter by branch, we check student.branchId if it exists?
    // Or we just ignore filters for this report type if they don't apply.
    
    return true;
  });
}
