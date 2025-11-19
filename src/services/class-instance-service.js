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
    const instanceDoc = await getDoc(doc(db, `studios/${businessId}/classInstances`, instanceId));
    
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
    const instancesRef = collection(db, `studios/${businessId}/classInstances`);
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
    const instancesRef = collection(db, `studios/${businessId}/classInstances`);
    
    const newInstance = {
      name: instanceData.name,
      teacherId: instanceData.teacherId,
      date: instanceData.date instanceof Date ? Timestamp.fromDate(instanceData.date) : instanceData.date,
      startTime: instanceData.startTime, // Time string like "10:00"
      duration: instanceData.duration,
      locationId: instanceData.locationId || '',
      status: 'scheduled', // scheduled, completed, cancelled, rescheduled
      isModified: false,
      templateId: instanceData.templateId || null,
      studentIds: instanceData.studentIds || [], // Array of enrolled student IDs
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
    const instanceRef = doc(db, `studios/${businessId}/classInstances`, instanceId);

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
    const instanceRef = doc(db, `studios/${businessId}/classInstances`, instanceId);

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
    const instanceRef = doc(db, `studios/${businessId}/classInstances`, instanceId);
    
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
    const instanceRef = doc(db, `studios/${businessId}/classInstances`, instanceId);

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
    const attendanceRef = collection(db, `studios/${businessId}/attendance`);
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
    
    // Get student IDs from the instance
    const studentIds = instance.studentIds || [];
    
    if (studentIds.length === 0) {
      return [];
    }

    // Get student details
    const students = await Promise.all(
      studentIds.map(async (studentId) => {
        const studentDoc = await getDoc(doc(db, `studios/${businessId}/students`, studentId));
        if (studentDoc.exists()) {
          return {
            id: studentDoc.id,
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
export async function getWeekClassInstances(businessId, startDate = new Date()) {
  try {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    const instances = await getClassInstances(businessId, {
      startDate: start,
      endDate: end
    });

    return instances;
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
    await deleteDoc(doc(db, `studios/${businessId}/classInstances`, instanceId));
    return true;
  } catch (error) {
    console.error('Error deleting class instance:', error);
    throw error;
  }
}

/**
 * Generate class instance from template on a specific date
 * Aggregates students from all active courses containing this template
 */
export async function generateInstanceFromTemplate(businessId, templateId, date) {
  try {
    // Import course and enrollment services (avoid circular dependency by importing here)
    const { getActiveCoursesWithTemplate } = await import('./course-service.js');
    const { getCourseStudentIds } = await import('./enrollment-service.js');
    const { getClassTemplateById } = await import('./class-template-service.js');
    
    // Get template info
    const template = await getClassTemplateById(businessId, templateId);
    
    // Get all active courses containing this template on the specified date
    const activeCourses = await getActiveCoursesWithTemplate(businessId, templateId, date);
    
    // Aggregate student IDs from all active courses
    const studentIdsArrays = await Promise.all(
      activeCourses.map(course => getCourseStudentIds(businessId, course.id, date))
    );
    
    // Flatten and deduplicate student IDs
    const allStudentIds = [...new Set(studentIdsArrays.flat())];
    
    // Create instance
    const instanceData = {
      name: template.name,
      teacherId: template.teacherId,
      date: date instanceof Date ? Timestamp.fromDate(date) : date,
      startTime: template.startTime,
      duration: template.duration,
      locationId: template.locationId,
      status: 'scheduled',
      isModified: false,
      templateId: template.id,
      studentIds: allStudentIds,
      notes: ''
    };
    
    return await createClassInstance(businessId, instanceData);
  } catch (error) {
    console.error('Error generating instance from template:', error);
    throw error;
  }
}

/**
 * Add student to existing instance (for enrollment sync)
 */
export async function addStudentToInstance(businessId, instanceId, studentId) {
  try {
    const instance = await getClassInstanceById(businessId, instanceId);
    const studentIds = instance.studentIds || [];
    
    // Check if student already in instance
    if (studentIds.includes(studentId)) {
      return { id: instanceId, studentIds };
    }
    
    const updatedStudentIds = [...studentIds, studentId];
    
    const instanceRef = doc(db, `studios/${businessId}/classInstances`, instanceId);
    await updateDoc(instanceRef, {
      studentIds: updatedStudentIds,
      updatedAt: serverTimestamp()
    });
    
    return { id: instanceId, studentIds: updatedStudentIds };
  } catch (error) {
    console.error('Error adding student to instance:', error);
    throw error;
  }
}

/**
 * Remove student from existing instance (for enrollment sync)
 */
export async function removeStudentFromInstance(businessId, instanceId, studentId) {
  try {
    const instance = await getClassInstanceById(businessId, instanceId);
    const studentIds = instance.studentIds || [];
    
    const updatedStudentIds = studentIds.filter(id => id !== studentId);
    
    const instanceRef = doc(db, `studios/${businessId}/classInstances`, instanceId);
    await updateDoc(instanceRef, {
      studentIds: updatedStudentIds,
      updatedAt: serverTimestamp()
    });
    
    return { id: instanceId, studentIds: updatedStudentIds };
  } catch (error) {
    console.error('Error removing student from instance:', error);
    throw error;
  }
}

/**
 * Get future instances for a template starting from a specific date
 */
export async function getFutureInstances(businessId, templateId, fromDate = new Date()) {
  try {
    const instancesRef = collection(db, `studios/${businessId}/classInstances`);
    const startTimestamp = fromDate instanceof Date ? Timestamp.fromDate(fromDate) : fromDate;
    
    const q = query(
      instancesRef,
      where('templateId', '==', templateId),
      where('date', '>=', startTimestamp),
      orderBy('date', 'asc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting future instances:', error);
    throw error;
  }
}

/**
 * Regenerate instance student list from courses (useful for manual fixes)
 */
export async function regenerateInstanceStudents(businessId, instanceId) {
  try {
    const instance = await getClassInstanceById(businessId, instanceId);
    
    if (!instance.templateId) {
      throw new Error('Cannot regenerate students for standalone instance');
    }
    
    // Get date from instance
    const date = instance.date?.toDate ? instance.date.toDate() : new Date(instance.date);
    
    // Import services
    const { getActiveCoursesWithTemplate } = await import('./course-service.js');
    const { getCourseStudentIds } = await import('./enrollment-service.js');
    
    // Get all active courses containing this template on the instance date
    const activeCourses = await getActiveCoursesWithTemplate(businessId, instance.templateId, date);
    
    // Aggregate student IDs
    const studentIdsArrays = await Promise.all(
      activeCourses.map(course => getCourseStudentIds(businessId, course.id, date))
    );
    
    const allStudentIds = [...new Set(studentIdsArrays.flat())];
    
    // Update instance
    const instanceRef = doc(db, `studios/${businessId}/classInstances`, instanceId);
    await updateDoc(instanceRef, {
      studentIds: allStudentIds,
      updatedAt: serverTimestamp()
    });
    
    return { id: instanceId, studentIds: allStudentIds };
  } catch (error) {
    console.error('Error regenerating instance students:', error);
    throw error;
  }
}
