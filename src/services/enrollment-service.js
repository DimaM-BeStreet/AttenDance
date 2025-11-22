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
 * Enrollment Service
 * Handles student enrollments to courses with effective date ranges
 */

/**
 * Enroll student in a course with effective from date
 */
export async function enrollStudentInCourse(businessId, courseId, studentId, effectiveFrom = new Date()) {
  try {
    const enrollmentsRef = collection(db, `businesses/${businessId}/enrollments`);
    
    // Check if enrollment already exists
    const existing = await getActiveEnrollment(businessId, courseId, studentId);
    if (existing) {
      throw new Error('התלמיד כבר רשום לקורס זה');
    }
    
    const newEnrollment = {
      courseId,
      studentId,
      effectiveFrom: effectiveFrom instanceof Date ? Timestamp.fromDate(effectiveFrom) : effectiveFrom,
      effectiveTo: null, // null means active, no end date
      status: 'active', // active, completed, cancelled
      paymentStatus: 'pending', // pending, paid, partial
      amountPaid: 0,
      totalAmount: 0,
      enrollmentDate: serverTimestamp(),
      notes: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const docRef = await addDoc(enrollmentsRef, newEnrollment);

    return {
      id: docRef.id,
      ...newEnrollment
    };
  } catch (error) {
    console.error('Error enrolling student in course:', error);
    throw error;
  }
}

/**
 * Get enrollment by ID
 */
export async function getEnrollmentById(businessId, enrollmentId) {
  try {
    const enrollmentDoc = await getDoc(doc(db, `businesses/${businessId}/enrollments`, enrollmentId));
    
    if (!enrollmentDoc.exists()) {
      throw new Error('Enrollment not found');
    }

    return {
      id: enrollmentDoc.id,
      ...enrollmentDoc.data()
    };
  } catch (error) {
    console.error('Error getting enrollment:', error);
    throw error;
  }
}

/**
 * Remove student from course with effective to date
 */
export async function removeStudentFromCourse(businessId, courseId, studentId, effectiveTo = new Date()) {
  try {
    const enrollment = await getActiveEnrollment(businessId, courseId, studentId);
    
    if (!enrollment) {
      throw new Error('Enrollment not found');
    }
    
    const enrollmentRef = doc(db, `businesses/${businessId}/enrollments`, enrollment.id);
    await updateDoc(enrollmentRef, {
      effectiveTo: effectiveTo instanceof Date ? Timestamp.fromDate(effectiveTo) : effectiveTo,
      status: 'completed',
      updatedAt: serverTimestamp()
    });
    
    return { id: enrollment.id, effectiveTo };
  } catch (error) {
    console.error('Error removing student from course:', error);
    throw error;
  }
}

/**
 * Get active enrollment for student in course
 */
export async function getActiveEnrollment(businessId, courseId, studentId) {
  try {
    const enrollmentsRef = collection(db, `businesses/${businessId}/enrollments`);
    const q = query(
      enrollmentsRef,
      where('courseId', '==', courseId),
      where('studentId', '==', studentId),
      where('status', '==', 'active')
    );
    
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      return null;
    }
    
    return {
      id: snapshot.docs[0].id,
      ...snapshot.docs[0].data()
    };
  } catch (error) {
    console.error('Error getting active enrollment:', error);
    throw error;
  }
}

/**
 * Get course enrollments active on a specific date
 */
export async function getActiveCourseEnrollments(businessId, courseId, forDate = new Date()) {
  try {
    const enrollmentsRef = collection(db, `businesses/${businessId}/enrollments`);
    const q = query(
      enrollmentsRef,
      where('courseId', '==', courseId),
      where('status', '==', 'active')
    );
    
    const snapshot = await getDocs(q);
    const enrollments = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Filter by effective dates
    const checkDate = forDate instanceof Date ? forDate : new Date(forDate);
    checkDate.setHours(0, 0, 0, 0);
    
    return enrollments.filter(enrollment => {
      const effectiveFrom = enrollment.effectiveFrom?.toDate ? enrollment.effectiveFrom.toDate() : new Date(enrollment.effectiveFrom);
      effectiveFrom.setHours(0, 0, 0, 0);
      
      // Check if started
      if (checkDate < effectiveFrom) {
        return false;
      }
      
      // Check if ended
      if (enrollment.effectiveTo) {
        const effectiveTo = enrollment.effectiveTo?.toDate ? enrollment.effectiveTo.toDate() : new Date(enrollment.effectiveTo);
        effectiveTo.setHours(23, 59, 59, 999);
        
        if (checkDate > effectiveTo) {
          return false;
        }
      }
      
      return true;
    });
  } catch (error) {
    console.error('Error getting active course enrollments:', error);
    throw error;
  }
}

/**
 * Get all enrollments with filters
 */
export async function getAllEnrollments(businessId, options = {}) {
  try {
    const enrollmentsRef = collection(db, `businesses/${businessId}/enrollments`);
    let q = enrollmentsRef;

    if (options.studentId) {
      q = query(q, where('studentId', '==', options.studentId));
    }

    if (options.courseId) {
      q = query(q, where('courseId', '==', options.courseId));
    }

    if (options.status) {
      q = query(q, where('status', '==', options.status));
    }

    if (options.paymentStatus) {
      q = query(q, where('paymentStatus', '==', options.paymentStatus));
    }

    q = query(q, orderBy('enrollmentDate', 'desc'));

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting enrollments:', error);
    throw error;
  }
}

/**
 * Get all students enrolled in a course on a specific date
 */
export async function getCourseStudentIds(businessId, courseId, forDate = new Date()) {
  try {
    const enrollments = await getActiveCourseEnrollments(businessId, courseId, forDate);
    return enrollments.map(e => e.studentId);
  } catch (error) {
    console.error('Error getting course student IDs:', error);
    throw error;
  }
}

/**
 * Get all active enrollments for a student
 */
export async function getStudentActiveEnrollments(businessId, studentId) {
  try {
    const enrollmentsRef = collection(db, `businesses/${businessId}/enrollments`);
    const q = query(
      enrollmentsRef,
      where('studentId', '==', studentId),
      where('status', '==', 'active'),
      orderBy('enrollmentDate', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting student active enrollments:', error);
    throw error;
  }
}

/**
 * Update enrollment status
 */
export async function updateEnrollmentStatus(businessId, enrollmentId, status) {
  try {
    const enrollmentRef = doc(db, `businesses/${businessId}/enrollments`, enrollmentId);
    
    await updateDoc(enrollmentRef, {
      status,
      updatedAt: serverTimestamp()
    });

    return true;
  } catch (error) {
    console.error('Error updating enrollment status:', error);
    throw error;
  }
}

/**
 * Update payment information
 */
export async function updateEnrollmentPayment(businessId, enrollmentId, paymentData) {
  try {
    const enrollmentRef = doc(db, `businesses/${businessId}/enrollments`, enrollmentId);
    
    const updates = {
      amountPaid: paymentData.amountPaid,
      paymentStatus: paymentData.paymentStatus,
      paymentDate: paymentData.paymentDate || serverTimestamp(),
      paymentMethod: paymentData.paymentMethod || '',
      updatedAt: serverTimestamp()
    };

    await updateDoc(enrollmentRef, updates);

    return true;
  } catch (error) {
    console.error('Error updating enrollment payment:', error);
    throw error;
  }
}

/**
 * Cancel enrollment
 */
export async function cancelEnrollment(businessId, enrollmentId, reason = '') {
  try {
    const enrollmentRef = doc(db, `businesses/${businessId}/enrollments`, enrollmentId);
    
    await updateDoc(enrollmentRef, {
      status: 'cancelled',
      cancellationReason: reason,
      cancelledAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    return true;
  } catch (error) {
    console.error('Error cancelling enrollment:', error);
    throw error;
  }
}

/**
 * Get enriched enrollment with student and course details
 */
export async function getEnrichedEnrollment(businessId, enrollmentId) {
  try {
    const enrollment = await getEnrollmentById(businessId, enrollmentId);
    
    // Get student info
    const studentDoc = await getDoc(doc(db, `businesses/${businessId}/students`, enrollment.studentId));
    if (studentDoc.exists()) {
      const student = studentDoc.data();
      enrollment.studentName = `${student.firstName} ${student.lastName}`;
      enrollment.studentPhone = student.phone;
    }

    // Get course info
    if (enrollment.courseId) {
      const courseDoc = await getDoc(doc(db, `businesses/${businessId}/courses`, enrollment.courseId));
      if (courseDoc.exists()) {
        enrollment.courseName = courseDoc.data().name;
      }
    }

    return enrollment;
  } catch (error) {
    console.error('Error getting enriched enrollment:', error);
    throw error;
  }
}

/**
 * Get all enriched enrollments
 */
export async function getAllEnrichedEnrollments(businessId, options = {}) {
  try {
    const enrollments = await getAllEnrollments(businessId, options);
    
    const enrichedEnrollments = await Promise.all(
      enrollments.map(enrollment => getEnrichedEnrollment(businessId, enrollment.id))
    );

    return enrichedEnrollments;
  } catch (error) {
    console.error('Error getting enriched enrollments:', error);
    throw error;
  }
}

/**
 * Check if student is already enrolled in course
 */
export async function isStudentEnrolledInCourse(businessId, studentId, courseId) {
  try {
    const enrollment = await getActiveEnrollment(businessId, courseId, studentId);
    return enrollment !== null;
  } catch (error) {
    console.error('Error checking enrollment:', error);
    throw error;
  }
}

/**
 * Get enrollment statistics for business
 */
export async function getEnrollmentStats(businessId) {
  try {
    const enrollments = await getAllEnrollments(businessId);
    
    const stats = {
      total: enrollments.length,
      active: 0,
      completed: 0,
      cancelled: 0,
      totalRevenue: 0,
      pendingRevenue: 0
    };

    enrollments.forEach(enrollment => {
      stats[enrollment.status] = (stats[enrollment.status] || 0) + 1;
      
      if (enrollment.paymentStatus === 'paid') {
        stats.totalRevenue += enrollment.amountPaid || 0;
      } else if (enrollment.paymentStatus === 'pending' || enrollment.paymentStatus === 'partial') {
        stats.pendingRevenue += (enrollment.totalAmount - enrollment.amountPaid) || 0;
      }
    });

    return stats;
  } catch (error) {
    console.error('Error getting enrollment stats:', error);
    throw error;
  }
}

/**
 * Get recent enrollments
 */
export async function getRecentEnrollments(businessId, limit = 10) {
  try {
    const enrollments = await getAllEnrollments(businessId);
    
    const enrichedEnrollments = await Promise.all(
      enrollments.slice(0, limit).map(enrollment => 
        getEnrichedEnrollment(businessId, enrollment.id)
      )
    );

    return enrichedEnrollments;
  } catch (error) {
    console.error('Error getting recent enrollments:', error);
    throw error;
  }
}

/**
 * Get pending payments
 */
export async function getPendingPayments(businessId) {
  try {
    const enrollments = await getAllEnrollments(businessId, {
      status: 'active'
    });

    const pending = enrollments.filter(e => 
      e.paymentStatus === 'pending' || e.paymentStatus === 'partial'
    );

    const enrichedPending = await Promise.all(
      pending.map(enrollment => getEnrichedEnrollment(businessId, enrollment.id))
    );

    return enrichedPending;
  } catch (error) {
    console.error('Error getting pending payments:', error);
    throw error;
  }
}
