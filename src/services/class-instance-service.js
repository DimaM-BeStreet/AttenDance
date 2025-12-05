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
  limit,
  startAfter,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';

/**
 * Helper to generate keywords for search
 */
function generateKeywords(text) {
  if (!text) return [];
  const words = text.toLowerCase().split(/\s+/);
  const keywords = new Set();
  
  words.forEach(word => {
    // Add full word
    keywords.add(word);
    
    // Add prefixes (min 2 chars)
    for (let i = 2; i <= word.length; i++) {
      keywords.add(word.substring(0, i));
    }
  });
  
  return Array.from(keywords);
}

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
 * Get class instances with filters (legacy - use getPaginatedClassInstances for better performance)
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
 * Get paginated class instances with cursor-based pagination
 * @param {string} businessId - Business ID
 * @param {object} options - Query options
 * @param {number} options.limit - Number of items per page (default: 20)
 * @param {DocumentSnapshot} options.startAfterDoc - Last document from previous page
 * @param {string} options.teacherId - Filter by teacher
 * @param {string} options.templateId - Filter by template
 * @param {string} options.status - Filter by status
 * @param {Date|Timestamp} options.startDate - Filter by start date
 * @param {Date|Timestamp} options.endDate - Filter by end date
 * @param {string} options.sortOrder - Sort order 'asc' or 'desc' (default: 'asc')
 * @returns {Promise<{instances: Array, lastDoc: DocumentSnapshot, hasMore: boolean}>}
 */
export async function getPaginatedClassInstances(businessId, options = {}) {
  try {
    const instancesRef = collection(db, `businesses/${businessId}/classInstances`);
    const pageLimit = options.limit || 20;
    let constraints = [];

    if (options.teacherId) {
      constraints.push(where('teacherId', '==', options.teacherId));
    }

    if (options.templateId) {
      constraints.push(where('templateId', '==', options.templateId));
    }

    if (options.status) {
      constraints.push(where('status', '==', options.status));
    }

    if (options.startDate) {
      const start = options.startDate instanceof Date ? Timestamp.fromDate(options.startDate) : options.startDate;
      constraints.push(where('date', '>=', start));
    }

    if (options.endDate) {
      const end = options.endDate instanceof Date ? Timestamp.fromDate(options.endDate) : options.endDate;
      constraints.push(where('date', '<=', end));
    }

    const sortOrder = options.sortOrder || 'asc';
    constraints.push(orderBy('date', sortOrder));

    if (options.startAfterDoc) {
      constraints.push(startAfter(options.startAfterDoc));
    }

    constraints.push(limit(pageLimit + 1));

    const q = query(instancesRef, ...constraints);
    const snapshot = await getDocs(q);
    
    const docs = snapshot.docs;
    const hasMore = docs.length > pageLimit;
    const instances = docs.slice(0, pageLimit).map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    const lastDoc = hasMore ? docs[pageLimit - 1] : (docs.length > 0 ? docs[docs.length - 1] : null);

    return {
      instances,
      lastDoc,
      hasMore,
      total: instances.length
    };
  } catch (error) {
    console.error('Error getting paginated class instances:', error);
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
      startTime: instanceData.startTime, // Time string like "10:00"
      duration: instanceData.duration,
      locationId: instanceData.locationId || '',
      status: 'scheduled', // scheduled, completed, cancelled, rescheduled
      isModified: false,
      templateId: instanceData.templateId || null,
      studentIds: instanceData.studentIds || [], // Array of enrolled student IDs
      notes: instanceData.notes || '',
      whatsappLink: instanceData.whatsappLink || '',
      keywords: generateKeywords(instanceData.name),
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

    if (updates.name) {
      updatedData.keywords = generateKeywords(updates.name);
    }

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
    
    // Get student IDs from the instance
    const studentIds = instance.studentIds || [];
    
    // Get regular student details
    const students = await Promise.all(
      studentIds.map(async (studentId) => {
        const studentDoc = await getDoc(doc(db, `businesses/${businessId}/students`, studentId));
        if (studentDoc.exists()) {
          return {
            id: studentDoc.id,
            ...studentDoc.data(),
            isTemp: false
          };
        }
        return null;
      })
    );

    // Get temp students for this class
    const { getTempStudentsByClass } = await import('./temp-students-service.js');
    const tempStudents = await getTempStudentsByClass(instanceId);
    
    // Format temp students to match regular student structure
    const formattedTempStudents = tempStudents.map(temp => ({
      id: temp.id,
      firstName: temp.name.split(' ')[0] || temp.name,
      lastName: temp.name.split(' ').slice(1).join(' ') || '',
      phone: temp.phone,
      notes: temp.notes || '',
      isTemp: true
    }));

    // Combine regular and temp students
    const allStudents = [...students.filter(s => s !== null), ...formattedTempStudents];
    
    return allStudents;
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
    await deleteDoc(doc(db, `businesses/${businessId}/classInstances`, instanceId));
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
    
    const instanceRef = doc(db, `businesses/${businessId}/classInstances`, instanceId);
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
    
    const instanceRef = doc(db, `businesses/${businessId}/classInstances`, instanceId);
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
    const instancesRef = collection(db, `businesses/${businessId}/classInstances`);
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
    const instanceRef = doc(db, `businesses/${businessId}/classInstances`, instanceId);
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

/**
 * Search class instances by name (substring search using keywords array)
 */
export async function searchClassInstances(businessId, searchTerm) {
  try {
    if (!searchTerm) return [];
    
    const instancesRef = collection(db, `businesses/${businessId}/classInstances`);
    const term = searchTerm.toLowerCase();
    
    // Array-contains search on keywords field
    const q = query(
      instancesRef,
      where('keywords', 'array-contains', term),
      limit(20)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
      const data = doc.data();
      const date = data.date?.toDate ? data.date.toDate() : new Date(data.date);
      const dateStr = date.toLocaleDateString('he-IL');
      return {
        id: doc.id,
        ...data,
        displayName: `${data.name} - ${dateStr} ${data.startTime}`
      };
    });
  } catch (error) {
    console.error('Error searching class instances:', error);
    throw error;
  }
}
