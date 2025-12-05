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
 * Course Service
 * Handles fixed-length courses with specific start and end dates
 */

/**
 * Get all courses for a business (legacy - use getPaginatedCourses for better performance)
 */
export async function getAllCourses(businessId, options = {}) {
  try {
    const coursesRef = collection(db, `businesses/${businessId}/courses`);
    let constraints = [];

    if (options.isActive !== undefined) {
      constraints.push(where('isActive', '==', options.isActive));
    }

    // Map legacy status filter to isActive
    if (options.status === 'cancelled') {
      constraints.push(where('isActive', '==', false));
    } else if (options.status === 'active') {
      constraints.push(where('isActive', '==', true));
    }

    const sortField = options.sortBy || 'startDate';
    constraints.push(orderBy(sortField, options.sortOrder || 'desc'));
    
    let q = query(coursesRef, ...constraints);

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting courses:', error);
    throw error;
  }
}

/**
 * Get paginated courses with cursor-based pagination
 * @param {string} businessId - Business ID
 * @param {object} options - Query options
 * @param {number} options.limit - Number of items per page (default: 20)
 * @param {DocumentSnapshot} options.startAfterDoc - Last document from previous page
 * @param {boolean} options.isActive - Filter by active status
 * @param {string} options.status - Filter by status
 * @param {string} options.sortBy - Field to sort by (default: 'startDate')
 * @param {string} options.sortOrder - Sort order 'asc' or 'desc' (default: 'desc')
 * @returns {Promise<{courses: Array, lastDoc: DocumentSnapshot, hasMore: boolean}>}
 */
export async function getPaginatedCourses(businessId, options = {}) {
  try {
    const coursesRef = collection(db, `businesses/${businessId}/courses`);
    const pageLimit = options.limit || 20;
    let constraints = [];

    if (options.isActive !== undefined) {
      constraints.push(where('isActive', '==', options.isActive));
    }

    // Map legacy status filter to isActive
    if (options.status === 'cancelled') {
      constraints.push(where('isActive', '==', false));
    } else if (options.status === 'active') {
      constraints.push(where('isActive', '==', true));
    }

    const now = new Date();

    if (options.timeFrame) {
      if (options.timeFrame === 'future') {
        constraints.push(where('startDate', '>', now));
        // Inequality filter requires orderBy on the same field
        options.sortBy = 'startDate';
        options.sortOrder = 'asc';
      } else if (options.timeFrame === 'past') {
        constraints.push(where('endDate', '<', now));
        // Inequality filter requires orderBy on the same field
        options.sortBy = 'endDate';
        options.sortOrder = 'desc';
      } else if (options.timeFrame === 'current') {
        // This is harder to query efficiently in Firestore with simple compound queries
        // because we need startDate <= now AND endDate >= now.
        // We can filter one and do the other in memory, or rely on client-side filtering.
        // For now, let's just filter by startDate <= now and sort by startDate desc
        constraints.push(where('startDate', '<=', now));
        // We can't easily add endDate >= now in the same query if we sort by startDate
      }
    }

    const sortField = options.sortBy || 'startDate';
    const sortOrder = options.sortOrder || 'desc';
    constraints.push(orderBy(sortField, sortOrder));

    if (options.startAfterDoc) {
      constraints.push(startAfter(options.startAfterDoc));
    }

    constraints.push(limit(pageLimit + 1));

    const q = query(coursesRef, ...constraints);
    const snapshot = await getDocs(q);
    
    const docs = snapshot.docs;
    const hasMore = docs.length > pageLimit;
    const courses = docs.slice(0, pageLimit).map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    const lastDoc = hasMore ? docs[pageLimit - 1] : (docs.length > 0 ? docs[docs.length - 1] : null);

    return {
      courses,
      lastDoc,
      hasMore,
      total: courses.length
    };
  } catch (error) {
    console.error('Error getting paginated courses:', error);
    throw error;
  }
}

/**
 * Get course by ID
 */
export async function getCourseById(businessId, courseId) {
  try {
    if (!businessId || !courseId) {
      throw new Error('Business ID and Course ID are required');
    }
    
    const courseDoc = await getDoc(doc(db, `businesses/${businessId}/courses`, courseId));
    
    if (!courseDoc.exists()) {
      throw new Error('Course not found');
    }

    return {
      id: courseDoc.id,
      ...courseDoc.data()
    };
  } catch (error) {
    console.error('Error getting course:', error);
    throw error;
  }
}

/**
 * Create new course
 */
export async function createCourse(businessId, courseData) {
  try {
    const coursesRef = collection(db, `businesses/${businessId}/courses`);
    
    const startDate = courseData.startDate instanceof Date ? courseData.startDate : courseData.startDate.toDate();
    const now = new Date();

    const newCourse = {
      name: courseData.name,
      templateIds: courseData.templateIds || [], // Array of class template IDs
      startDate: courseData.startDate instanceof Date ? Timestamp.fromDate(courseData.startDate) : courseData.startDate,
      endDate: courseData.endDate instanceof Date ? Timestamp.fromDate(courseData.endDate) : courseData.endDate,
      schedule: courseData.schedule || [], // Array of {dayOfWeek, startTime, duration}
      maxStudents: courseData.maxStudents || null,
      price: courseData.price || 0,
      description: courseData.description || '',
      isActive: true,
      keywords: generateKeywords(courseData.name),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const docRef = await addDoc(coursesRef, newCourse);

    return {
      id: docRef.id,
      ...newCourse
    };
  } catch (error) {
    console.error('Error creating course:', error);
    throw error;
  }
}

/**
 * Update course
 */
export async function updateCourse(businessId, courseId, courseData) {
  try {
    const courseRef = doc(db, `businesses/${businessId}/courses`, courseId);

    const updates = {
      ...courseData,
      updatedAt: serverTimestamp()
    };

    if (courseData.name) {
      updates.keywords = generateKeywords(courseData.name);
    }

    await updateDoc(courseRef, updates);

    return {
      id: courseId,
      ...updates
    };
  } catch (error) {
    console.error('Error updating course:', error);
    throw error;
  }
}

/**
 * Update course active status (cancel/activate)
 */
export async function updateCourseActiveStatus(businessId, courseId, isActive) {
  try {
    const courseRef = doc(db, `businesses/${businessId}/courses`, courseId);
    
    await updateDoc(courseRef, {
      isActive,
      updatedAt: serverTimestamp()
    });

    return true;
  } catch (error) {
    console.error('Error updating course active status:', error);
    throw error;
  }
}

/**
 * Get enrolled students for a course
 */
export async function getCourseEnrollments(businessId, courseId) {
  try {
    const enrollmentsRef = collection(db, `businesses/${businessId}/enrollments`);
    const q = query(
      enrollmentsRef,
      where('courseId', '==', courseId),
      where('isActive', '==', true)
    );
    
    const snapshot = await getDocs(q);
    const enrollments = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Get student details
    const studentsWithEnrollments = await Promise.all(
      enrollments.map(async (enrollment) => {
        const studentDoc = await getDoc(doc(db, `businesses/${businessId}/students`, enrollment.studentId));
        if (studentDoc.exists()) {
          return {
            enrollmentId: enrollment.id,
            studentId: studentDoc.id,
            ...studentDoc.data(),
            enrollmentDate: enrollment.enrollmentDate,
            paymentStatus: enrollment.paymentStatus
          };
        }
        return null;
      })
    );

    return studentsWithEnrollments.filter(s => s !== null);
  } catch (error) {
    console.error('Error getting course enrollments:', error);
    throw error;
  }
}

/**
 * Get course statistics
 */
export async function getCourseStats(businessId, courseId) {
  try {
    const enrollments = await getCourseEnrollments(businessId, courseId);
    const course = await getCourseById(businessId, courseId);

    // Calculate total revenue
    const totalRevenue = enrollments.reduce((sum, e) => {
      return sum + (e.paymentStatus === 'paid' ? course.price : 0);
    }, 0);

    const pendingPayments = enrollments.filter(e => e.paymentStatus === 'pending').length;

    return {
      totalEnrolled: enrollments.length,
      maxStudents: course.maxStudents,
      availableSpots: course.maxStudents ? course.maxStudents - enrollments.length : null,
      totalRevenue,
      pendingPayments
    };
  } catch (error) {
    console.error('Error getting course stats:', error);
    throw error;
  }
}

/**
 * Check if course is full
 */
export async function isCurseFull(businessId, courseId) {
  try {
    const course = await getCourseById(businessId, courseId);
    
    if (!course.maxStudents) {
      return false;
    }

    const enrollments = await getCourseEnrollments(businessId, courseId);
    return enrollments.length >= course.maxStudents;
  } catch (error) {
    console.error('Error checking if course is full:', error);
    throw error;
  }
}

/**
 * Get enriched course with teacher info and enrollment count
 */
export async function getEnrichedCourse(businessId, courseId) {
  try {
    const course = await getCourseById(businessId, courseId);
    
    // Get teacher info
    if (course.teacherId) {
      const teacherDoc = await getDoc(doc(db, `businesses/${businessId}/teachers`, course.teacherId));
      if (teacherDoc.exists()) {
        const teacher = teacherDoc.data();
        course.teacherName = `${teacher.firstName} ${teacher.lastName}`;
      }
    }

    // Get enrollment count
    const enrollments = await getCourseEnrollments(businessId, courseId);
    course.enrollmentCount = enrollments.length;

    return course;
  } catch (error) {
    console.error('Error getting enriched course:', error);
    throw error;
  }
}

/**
 * Get all enriched courses
 */
export async function getAllEnrichedCourses(businessId, options = {}) {
  try {
    const courses = await getAllCourses(businessId, options);
    
    const enrichedCourses = await Promise.all(
      courses.map(course => getEnrichedCourse(businessId, course.id))
    );

    return enrichedCourses;
  } catch (error) {
    console.error('Error getting enriched courses:', error);
    throw error;
  }
}

/**
 * Duplicate course
 */
export async function duplicateCourse(businessId, courseId) {
  try {
    const originalCourse = await getCourseById(businessId, courseId);
    
    const { id, createdAt, updatedAt, ...courseData } = originalCourse;
    
    courseData.name = `${courseData.name} (Copy)`;
    courseData.isActive = true;
    
    return await createCourse(businessId, courseData);
  } catch (error) {
    console.error('Error duplicating course:', error);
    throw error;
  }
}

/**
 * Add templates to course
 */
export async function addTemplatesToCourse(businessId, courseId, templateIds) {
  try {
    const course = await getCourseById(businessId, courseId);
    const currentTemplateIds = course.templateIds || [];
    
    // Filter out duplicates
    const newTemplateIds = templateIds.filter(id => !currentTemplateIds.includes(id));
    
    if (newTemplateIds.length === 0) {
      return { id: courseId, templateIds: currentTemplateIds };
    }
    
    const updatedTemplateIds = [...currentTemplateIds, ...newTemplateIds];
    
    const courseRef = doc(db, `businesses/${businessId}/courses`, courseId);
    await updateDoc(courseRef, {
      templateIds: updatedTemplateIds,
      updatedAt: serverTimestamp()
    });
    
    return { id: courseId, templateIds: updatedTemplateIds };
  } catch (error) {
    console.error('Error adding templates to course:', error);
    throw error;
  }
}

/**
 * Remove templates from course
 */
export async function removeTemplatesFromCourse(businessId, courseId, templateIds) {
  try {
    const course = await getCourseById(businessId, courseId);
    const currentTemplateIds = course.templateIds || [];
    
    const updatedTemplateIds = currentTemplateIds.filter(id => !templateIds.includes(id));
    
    const courseRef = doc(db, `businesses/${businessId}/courses`, courseId);
    await updateDoc(courseRef, {
      templateIds: updatedTemplateIds,
      updatedAt: serverTimestamp()
    });
    
    return { id: courseId, templateIds: updatedTemplateIds };
  } catch (error) {
    console.error('Error removing templates from course:', error);
    throw error;
  }
}

/**
 * Get all courses that include a specific template
 */
export async function getCoursesWithTemplate(businessId, templateId) {
  try {
    const coursesRef = collection(db, `businesses/${businessId}/courses`);
    const q = query(
      coursesRef,
      where('templateIds', 'array-contains', templateId),
      where('isActive', '==', true)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting courses with template:', error);
    throw error;
  }
}

/**
 * Check if course is active on a specific date
 */
export function isCourseActiveOnDate(course, date) {
  try {
    const checkDate = date instanceof Date ? date : new Date(date);
    
    // Convert Firestore Timestamps to dates if needed
    const startDate = course.startDate?.toDate ? course.startDate.toDate() : new Date(course.startDate);
    const endDate = course.endDate?.toDate ? course.endDate.toDate() : new Date(course.endDate);
    
    // Set time to midnight for accurate date comparison
    checkDate.setHours(0, 0, 0, 0);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    
    return checkDate >= startDate && checkDate <= endDate && course.isActive;
  } catch (error) {
    console.error('Error checking if course is active on date:', error);
    return false;
  }
}

/**
 * Get active courses containing a template on a specific date
 */
export async function getActiveCoursesWithTemplate(businessId, templateId, date) {
  try {
    const courses = await getCoursesWithTemplate(businessId, templateId);
    
    return courses.filter(course => isCourseActiveOnDate(course, date));
  } catch (error) {
    console.error('Error getting active courses with template:', error);
    throw error;
  }
}

/**
 * Search courses by name (substring search using keywords array)
 */
export async function searchCourses(businessId, searchTerm) {
  try {
    if (!searchTerm) return [];
    
    const coursesRef = collection(db, `businesses/${businessId}/courses`);
    const terms = searchTerm.toLowerCase().split(/\s+/).filter(t => t.length > 0);
    
    if (terms.length === 0) return [];

    // Use the first term for the database query
    const firstTerm = terms[0];
    
    // Array-contains search on keywords field
    const q = query(
      coursesRef, 
      where('keywords', 'array-contains', firstTerm),
      limit(50)
    );
    
    const snapshot = await getDocs(q);
    
    // Filter for active courses in memory and check all terms
    return snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(course => {
        if (course.isActive === false) return false;
        
        // If multiple terms, ensure all are present in keywords
        if (terms.length > 1) {
            const courseKeywords = course.keywords || [];
            return terms.every(term => courseKeywords.includes(term));
        }
        
        return true;
      });
      
  } catch (error) {
    console.error('Error searching courses:', error);
    return [];
  }
}
