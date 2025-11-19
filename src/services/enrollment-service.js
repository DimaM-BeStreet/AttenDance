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
 * Handles student enrollments to courses and class templates
 */

/**
 * Enroll student in a course or template
 */
export async function createEnrollment(businessId, enrollmentData) {
  try {
    const enrollmentsRef = collection(db, `businesses/${businessId}/enrollments`);
    
    const newEnrollment = {
      studentId: enrollmentData.studentId,
      enrollmentType: enrollmentData.enrollmentType, // 'course' or 'template'
      courseId: enrollmentData.courseId || null,
      templateId: enrollmentData.templateId || null,
      status: 'active', // active, completed, cancelled
      paymentStatus: enrollmentData.paymentStatus || 'pending', // pending, paid, partial
      amountPaid: enrollmentData.amountPaid || 0,
      totalAmount: enrollmentData.totalAmount || 0,
      enrollmentDate: serverTimestamp(),
      notes: enrollmentData.notes || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const docRef = await addDoc(enrollmentsRef, newEnrollment);

    return {
      id: docRef.id,
      ...newEnrollment
    };
  } catch (error) {
    console.error('Error creating enrollment:', error);
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

    if (options.templateId) {
      q = query(q, where('templateId', '==', options.templateId));
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
 * Get enriched enrollment with student, course/template details
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

    // Get course or template info
    if (enrollment.enrollmentType === 'course' && enrollment.courseId) {
      const courseDoc = await getDoc(doc(db, `businesses/${businessId}/courses`, enrollment.courseId));
      if (courseDoc.exists()) {
        enrollment.courseName = courseDoc.data().name;
      }
    } else if (enrollment.enrollmentType === 'template' && enrollment.templateId) {
      const templateDoc = await getDoc(doc(db, `businesses/${businessId}/classTemplates`, enrollment.templateId));
      if (templateDoc.exists()) {
        enrollment.templateName = templateDoc.data().name;
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
 * Check if student is already enrolled
 */
export async function isStudentEnrolled(businessId, studentId, courseId = null, templateId = null) {
  try {
    const enrollmentsRef = collection(db, `businesses/${businessId}/enrollments`);
    let q = query(
      enrollmentsRef,
      where('studentId', '==', studentId),
      where('status', '==', 'active')
    );

    if (courseId) {
      q = query(q, where('courseId', '==', courseId));
    }

    if (templateId) {
      q = query(q, where('templateId', '==', templateId));
    }

    const snapshot = await getDocs(q);
    return snapshot.size > 0;
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
