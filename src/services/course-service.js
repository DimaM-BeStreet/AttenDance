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
 * Course Service
 * Handles fixed-length courses with specific start and end dates
 */

/**
 * Get all courses for a business
 */
export async function getAllCourses(businessId, options = {}) {
  try {
    const coursesRef = collection(db, `studios/${businessId}/courses`);
    let q = coursesRef;

    if (options.isActive !== undefined) {
      q = query(q, where('isActive', '==', options.isActive));
    }

    if (options.status) {
      q = query(q, where('status', '==', options.status));
    }

    const sortField = options.sortBy || 'startDate';
    q = query(q, orderBy(sortField, options.sortOrder || 'desc'));

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
 * Get course by ID
 */
export async function getCourseById(businessId, courseId) {
  try {
    const courseDoc = await getDoc(doc(db, `studios/${businessId}/courses`, courseId));
    
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
    const coursesRef = collection(db, `studios/${businessId}/courses`);
    
    const newCourse = {
      name: courseData.name,
      danceStyleId: courseData.danceStyleId,
      templateIds: courseData.templateIds || [], // Array of class template IDs
      startDate: courseData.startDate instanceof Date ? Timestamp.fromDate(courseData.startDate) : courseData.startDate,
      endDate: courseData.endDate instanceof Date ? Timestamp.fromDate(courseData.endDate) : courseData.endDate,
      schedule: courseData.schedule, // Array of {dayOfWeek, startTime, duration}
      maxStudents: courseData.maxStudents || null,
      price: courseData.price || 0,
      description: courseData.description || '',
      status: 'upcoming', // upcoming, active, completed, cancelled
      isActive: true,
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
    const courseRef = doc(db, `studios/${businessId}/courses`, courseId);

    const updates = {
      ...courseData,
      updatedAt: serverTimestamp()
    };

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
 * Update course status
 */
export async function updateCourseStatus(businessId, courseId, status) {
  try {
    const courseRef = doc(db, `studios/${businessId}/courses`, courseId);
    
    await updateDoc(courseRef, {
      status,
      updatedAt: serverTimestamp()
    });

    return true;
  } catch (error) {
    console.error('Error updating course status:', error);
    throw error;
  }
}

/**
 * Get enrolled students for a course
 */
export async function getCourseEnrollments(businessId, courseId) {
  try {
    const enrollmentsRef = collection(db, `studios/${businessId}/enrollments`);
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

    // Get student details
    const studentsWithEnrollments = await Promise.all(
      enrollments.map(async (enrollment) => {
        const studentDoc = await getDoc(doc(db, `studios/${businessId}/students`, enrollment.studentId));
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
 * Get enriched course with teacher and style names
 */
export async function getEnrichedCourse(businessId, courseId) {
  try {
    const course = await getCourseById(businessId, courseId);
    
    // Get teacher info
    if (course.teacherId) {
      const teacherDoc = await getDoc(doc(db, `studios/${businessId}/teachers`, course.teacherId));
      if (teacherDoc.exists()) {
        const teacher = teacherDoc.data();
        course.teacherName = `${teacher.firstName} ${teacher.lastName}`;
      }
    }

    // Get dance style info
    if (course.danceStyleId) {
      const styleDoc = await getDoc(doc(db, `studios/${businessId}/danceStyles`, course.danceStyleId));
      if (styleDoc.exists()) {
        course.danceStyleName = styleDoc.data().name;
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
    
    const { id, createdAt, updatedAt, status, ...courseData } = originalCourse;
    
    courseData.name = `${courseData.name} (Copy)`;
    courseData.status = 'upcoming';
    
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
    
    const courseRef = doc(db, `studios/${businessId}/courses`, courseId);
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
    
    const courseRef = doc(db, `studios/${businessId}/courses`, courseId);
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
    const coursesRef = collection(db, `studios/${businessId}/courses`);
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
