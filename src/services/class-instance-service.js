import { db } from '@config/firebase-config';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  query, 
  where, 
  orderBy,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';

/**
 * Class Instance Service
 * Handles individual class instances (generated from templates or standalone)
 * Allows modifications, cancellations, and rescheduling
 */

/**
 * Get class instance by ID
 */
export async function getClassInstanceById(businessId, instanceId) {
  try {
    const instanceDoc = await getDoc(doc(db, `businesses/${businessId}/classInstances`, instanceId));
    
    if (!instanceDoc.exists()) {
      throw new Error('Class instance not found');
    }

    return {
      id: instanceDoc.id,
      ...instanceDoc.data()
    };
  } catch (error) {
    console.error('Error getting class instance:', error);
    throw error;
  }
}

/**
 * Get class instances with filters
 */
export async function getClassInstances(businessId, options = {}) {
  try {
    const instancesRef = collection(db, `businesses/${businessId}/classInstances`);
    let q = instancesRef;

    // Apply filters
    if (options.teacherId) {
      q = query(q, where('teacherId', '==', options.teacherId));
    }

    if (options.templateId) {
      q = query(q, where('templateId', '==', options.templateId));
    }

    if (options.status) {
      q = query(q, where('status', '==', options.status));
    }

    if (options.startDate) {
      const start = options.startDate instanceof Date ? Timestamp.fromDate(options.startDate) : options.startDate;
      q = query(q, where('date', '>=', start));
    }

    if (options.endDate) {
      const end = options.endDate instanceof Date ? Timestamp.fromDate(options.endDate) : options.endDate;
      q = query(q, where('date', '<=', end));
    }

    q = query(q, orderBy('date', options.sortOrder || 'asc'));

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting class instances:', error);
    throw error;
  }
}

/**
 * Create standalone class instance (not from template)
 */
export async function createClassInstance(businessId, instanceData) {
  try {
    const instancesRef = collection(db, `businesses/${businessId}/classInstances`);
    
    const newInstance = {
      name: instanceData.name,
      teacherId: instanceData.teacherId,
      date: instanceData.date instanceof Date ? Timestamp.fromDate(instanceData.date) : instanceData.date,
      startTime: instanceData.startTime,
      duration: instanceData.duration,
      location: instanceData.location || '',
      maxStudents: instanceData.maxStudents || null,
      status: 'scheduled', // scheduled, completed, cancelled, rescheduled
      isModified: false,
      templateId: instanceData.templateId || null,
      notes: instanceData.notes || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const docRef = await addDoc(instancesRef, newInstance);

    return {
      id: docRef.id,
      ...newInstance
    };
  } catch (error) {
    console.error('Error creating class instance:', error);
    throw error;
  }
}

/**
 * Update class instance
 */
export async function updateClassInstance(businessId, instanceId, updates) {
  try {
    const instanceRef = doc(db, `businesses/${businessId}/classInstances`, instanceId);

    const updatedData = {
      ...updates,
      isModified: true,
      updatedAt: serverTimestamp()
    };

    await updateDoc(instanceRef, updatedData);

    return {
      id: instanceId,
      ...updatedData
    };
  } catch (error) {
    console.error('Error updating class instance:', error);
    throw error;
  }
}

/**
 * Cancel class instance
 */
export async function cancelClassInstance(businessId, instanceId, reason = '') {
  try {
    const instanceRef = doc(db, `businesses/${businessId}/classInstances`, instanceId);

    await updateDoc(instanceRef, {
      status: 'cancelled',
      cancellationReason: reason,
      cancelledAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    return true;
  } catch (error) {
    console.error('Error cancelling class instance:', error);
    throw error;
  }
}

/**
 * Reschedule class instance
 */
export async function rescheduleClassInstance(businessId, instanceId, newDate, newStartTime) {
  try {
    const instanceRef = doc(db, `businesses/${businessId}/classInstances`, instanceId);
    
    // Store original date and time
    const originalInstance = await getClassInstanceById(businessId, instanceId);

    await updateDoc(instanceRef, {
      originalDate: originalInstance.date,
      originalStartTime: originalInstance.startTime,
      date: newDate instanceof Date ? Timestamp.fromDate(newDate) : newDate,
      startTime: newStartTime,
      status: 'rescheduled',
      isModified: true,
      updatedAt: serverTimestamp()
    });

    return true;
  } catch (error) {
    console.error('Error rescheduling class instance:', error);
    throw error;
  }
}

/**
 * Mark class as completed
 */
export async function completeClassInstance(businessId, instanceId) {
  try {
    const instanceRef = doc(db, `businesses/${businessId}/classInstances`, instanceId);

    await updateDoc(instanceRef, {
      status: 'completed',
      completedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    return true;
  } catch (error) {
    console.error('Error completing class instance:', error);
    throw error;
  }
}

/**
 * Get attendance for a class instance
 */
export async function getInstanceAttendance(businessId, instanceId) {
  try {
    const attendanceRef = collection(db, `businesses/${businessId}/attendance`);
    const q = query(attendanceRef, where('classInstanceId', '==', instanceId));
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting instance attendance:', error);
    throw error;
  }
}

/**
 * Get enrolled students for a class instance
 */
export async function getInstanceEnrolledStudents(businessId, instanceId) {
  try {
    const instance = await getClassInstanceById(businessId, instanceId);
    
    if (!instance.templateId) {
      return [];
    }

    // Get enrollments for the template
    const enrollmentsRef = collection(db, `businesses/${businessId}/enrollments`);
    const q = query(
      enrollmentsRef,
      where('templateId', '==', instance.templateId),
      where('status', '==', 'active')
    );
    
    const snapshot = await getDocs(q);
    const enrollments = snapshot.docs.map(doc => doc.data());

    // Get student details
    const students = await Promise.all(
      enrollments.map(async (enrollment) => {
        const studentDoc = await getDoc(doc(db, `businesses/${businessId}/students`, enrollment.studentId));
        if (studentDoc.exists()) {
          return {
            id: studentDoc.id,
            enrollmentId: enrollment.id,
            ...studentDoc.data()
          };
        }
        return null;
      })
    );

    return students.filter(s => s !== null);
  } catch (error) {
    console.error('Error getting instance enrolled students:', error);
    throw error;
  }
}

/**
 * Get upcoming instances for today
 */
export async function getTodayClassInstances(businessId) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const instances = await getClassInstances(businessId, {
      startDate: today,
      endDate: tomorrow,
      sortOrder: 'asc'
    });

    return instances;
  } catch (error) {
    console.error('Error getting today class instances:', error);
    throw error;
  }
}

/**
 * Get week view of class instances
 */
export async function getWeekClassInstances(businessId, startDate) {
  try {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    const instances = await getClassInstances(businessId, {
      startDate: start,
      endDate: end
    });

    // Group by date
    const grouped = {};
    instances.forEach(instance => {
      const dateKey = instance.date.toDate().toISOString().split('T')[0];
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(instance);
    });

    return grouped;
  } catch (error) {
    console.error('Error getting week class instances:', error);
    throw error;
  }
}

/**
 * Delete class instance
 */
export async function deleteClassInstance(businessId, instanceId) {
  try {
    await deleteDoc(doc(db, `businesses/${businessId}/classInstances`, instanceId));
    return true;
  } catch (error) {
    console.error('Error deleting class instance:', error);
    throw error;
  }
}
