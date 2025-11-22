import { db, storage, functions } from '@config/firebase-config';
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
  serverTimestamp
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';

/**
 * Teacher Service
 * Handles all teacher-related operations including CRUD, photo management, and unique links
 */

/**
 * Get all teachers for a business
 */
export async function getAllTeachers(businessId, options = {}) {
  try {
    const teachersRef = collection(db, `businesses/${businessId}/teachers`);
    let q = teachersRef;

    // Apply filters
    if (options.isActive !== undefined) {
      q = query(q, where('isActive', '==', options.isActive));
    }

    // Apply sorting
    const sortField = options.sortBy || 'firstName';
    q = query(q, orderBy(sortField));

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting teachers:', error);
    throw error;
  }
}

/**
 * Get single teacher by ID
 */
export async function getTeacherById(businessId, teacherId) {
  try {
    const teacherDoc = await getDoc(doc(db, `businesses/${businessId}/teachers`, teacherId));
    
    if (!teacherDoc.exists()) {
      throw new Error('Teacher not found');
    }

    return {
      id: teacherDoc.id,
      ...teacherDoc.data()
    };
  } catch (error) {
    console.error('Error getting teacher:', error);
    throw error;
  }
}

/**
 * Search teachers by name, phone, or specialization
 */
export async function searchTeachers(businessId, searchTerm) {
  try {
    const allTeachers = await getAllTeachers(businessId);
    const term = searchTerm.toLowerCase();

    return allTeachers.filter(teacher => {
      const fullName = `${teacher.firstName} ${teacher.lastName}`.toLowerCase();
      const phone = teacher.phone || '';
      const specializations = (teacher.specializations || []).join(' ').toLowerCase();
      
      return fullName.includes(term) || 
             phone.includes(term) || 
             specializations.includes(term);
    });
  } catch (error) {
    console.error('Error searching teachers:', error);
    throw error;
  }
}

/**
 * Upload teacher photo to Firebase Storage
 */
export async function uploadTeacherPhoto(businessId, teacherId, file) {
  try {
    const photoRef = ref(storage, `businesses/${businessId}/teachers/${teacherId}/profile.jpg`);
    await uploadBytes(photoRef, file);
    const photoURL = await getDownloadURL(photoRef);
    return photoURL;
  } catch (error) {
    console.error('Error uploading teacher photo:', error);
    throw error;
  }
}

/**
 * Delete teacher photo from Firebase Storage
 */
export async function deleteTeacherPhoto(businessId, teacherId) {
  try {
    const photoRef = ref(storage, `businesses/${businessId}/teachers/${teacherId}/profile.jpg`);
    await deleteObject(photoRef);
  } catch (error) {
    if (error.code !== 'storage/object-not-found') {
      console.error('Error deleting teacher photo:', error);
      throw error;
    }
  }
}

/**
 * Generate unique access link for teacher
 */
export async function generateTeacherLink(businessId, teacherId) {
  try {
    const generateLink = httpsCallable(functions, 'generateTeacherLink');
    const result = await generateLink({ businessId, teacherId });
    
    return result.data;
  } catch (error) {
    console.error('Error generating teacher link:', error);
    throw error;
  }
}

/**
 * Validate teacher access link
 */
export async function validateTeacherLink(linkToken) {
  try {
    const validateLink = httpsCallable(functions, 'validateTeacherLink');
    const result = await validateLink({ linkToken });
    
    return result.data;
  } catch (error) {
    console.error('Error validating teacher link:', error);
    throw error;
  }
}

/**
 * Create new teacher
 */
export async function createTeacher(businessId, teacherData, photoFile = null) {
  try {
    const teachersRef = collection(db, `businesses/${businessId}/teachers`);
    
    // Prepare teacher data
    const newTeacher = {
      ...teacherData,
      isActive: true,
      uniqueLink: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    // Create teacher document
    const docRef = await addDoc(teachersRef, newTeacher);
    const teacherId = docRef.id;

    // Upload photo if provided
    if (photoFile) {
      const photoURL = await uploadTeacherPhoto(businessId, teacherId, photoFile);
      await updateDoc(docRef, { photoURL });
      newTeacher.photoURL = photoURL;
    }

    // Generate unique access link
    const linkData = await generateTeacherLink(businessId, teacherId);
    await updateDoc(docRef, { 
      uniqueLink: linkData.linkToken,
      linkUrl: linkData.url 
    });
    newTeacher.uniqueLink = linkData.linkToken;
    newTeacher.linkUrl = linkData.url;

    return {
      id: teacherId,
      ...newTeacher
    };
  } catch (error) {
    console.error('Error creating teacher:', error);
    throw error;
  }
}

/**
 * Update teacher
 */
export async function updateTeacher(businessId, teacherId, teacherData, photoFile = null) {
  try {
    const teacherRef = doc(db, `businesses/${businessId}/teachers`, teacherId);

    const updates = {
      ...teacherData,
      updatedAt: serverTimestamp()
    };

    // Handle photo update
    if (photoFile) {
      try {
        await deleteTeacherPhoto(businessId, teacherId);
      } catch (error) {
        // Ignore if no existing photo
      }
      
      const photoURL = await uploadTeacherPhoto(businessId, teacherId, photoFile);
      updates.photoURL = photoURL;
    }

    await updateDoc(teacherRef, updates);

    return {
      id: teacherId,
      ...updates
    };
  } catch (error) {
    console.error('Error updating teacher:', error);
    throw error;
  }
}

/**
 * Delete teacher (soft delete)
 */
export async function deleteTeacher(businessId, teacherId) {
  try {
    const teacherRef = doc(db, `businesses/${businessId}/teachers`, teacherId);
    
    await updateDoc(teacherRef, {
      isActive: false,
      deletedAt: serverTimestamp()
    });

    return true;
  } catch (error) {
    console.error('Error deleting teacher:', error);
    throw error;
  }
}

/**
 * Activate/Deactivate teacher
 */
export async function updateTeacherActiveStatus(businessId, teacherId, isActive) {
  try {
    const teacherRef = doc(db, `businesses/${businessId}/teachers`, teacherId);
    
    await updateDoc(teacherRef, {
      isActive,
      updatedAt: serverTimestamp()
    });

    return true;
  } catch (error) {
    console.error('Error updating teacher active status:', error);
    throw error;
  }
}

/**
 * Regenerate teacher unique link
 */
export async function regenerateTeacherLink(businessId, teacherId) {
  try {
    const linkData = await generateTeacherLink(businessId, teacherId);
    
    const teacherRef = doc(db, `businesses/${businessId}/teachers`, teacherId);
    await updateDoc(teacherRef, {
      uniqueLink: linkData.linkToken,
      linkUrl: linkData.url,
      updatedAt: serverTimestamp()
    });

    return linkData;
  } catch (error) {
    console.error('Error regenerating teacher link:', error);
    throw error;
  }
}

/**
 * Get teacher's assigned classes
 */
export async function getTeacherClasses(businessId, teacherId) {
  try {
    // Get class templates
    const templatesRef = collection(db, `businesses/${businessId}/classTemplates`);
    const templatesQuery = query(templatesRef, where('teacherId', '==', teacherId));
    const templatesSnapshot = await getDocs(templatesQuery);
    
    const templates = templatesSnapshot.docs.map(doc => ({
      id: doc.id,
      type: 'template',
      ...doc.data()
    }));

    // Get courses
    const coursesRef = collection(db, `businesses/${businessId}/courses`);
    const coursesQuery = query(coursesRef, where('teacherId', '==', teacherId));
    const coursesSnapshot = await getDocs(coursesQuery);
    
    const courses = coursesSnapshot.docs.map(doc => ({
      id: doc.id,
      type: 'course',
      ...doc.data()
    }));

    return [...templates, ...courses];
  } catch (error) {
    console.error('Error getting teacher classes:', error);
    throw error;
  }
}

/**
 * Get teacher's upcoming class instances
 */
export async function getTeacherUpcomingClasses(businessId, teacherId, limit = 10) {
  try {
    const instancesRef = collection(db, `businesses/${businessId}/classInstances`);
    const now = new Date();
    
    const q = query(
      instancesRef,
      where('teacherId', '==', teacherId),
      where('date', '>=', now),
      orderBy('date', 'asc')
    );

    const snapshot = await getDocs(q);
    const instances = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return instances.slice(0, limit);
  } catch (error) {
    console.error('Error getting teacher upcoming classes:', error);
    throw error;
  }
}

/**
 * Get teacher statistics
 */
export async function getTeacherStats(businessId, teacherId) {
  try {
    const classes = await getTeacherClasses(businessId, teacherId);
    const upcomingClasses = await getTeacherUpcomingClasses(businessId, teacherId);

    // Count enrolled students across all classes
    const enrollmentsRef = collection(db, `businesses/${businessId}/enrollments`);
    const enrollmentsSnapshot = await getDocs(enrollmentsRef);
    const enrollments = enrollmentsSnapshot.docs.map(d => d.data());
    
    const uniqueStudents = new Set();
    classes.forEach(cls => {
      const classEnrollments = enrollments.filter(e => 
        (e.templateId === cls.id || e.courseId === cls.id) && e.status === 'active'
      );
      classEnrollments.forEach(e => uniqueStudents.add(e.studentId));
    });

    return {
      totalClasses: classes.length,
      upcomingClasses: upcomingClasses.length,
      totalStudents: uniqueStudents.size
    };
  } catch (error) {
    console.error('Error getting teacher stats:', error);
    throw error;
  }
}

/**
 * Mark attendance for a student (via Cloud Function for security)
 */
export async function markAttendance(linkToken, classInstanceId, studentId, businessId, status, notes = '') {
  try {
    const markAttendanceFunction = httpsCallable(functions, 'markAttendance');
    const result = await markAttendanceFunction({
      linkToken,
      classInstanceId,
      studentId,
      businessId,
      status,
      notes
    });
    return result.data;
  } catch (error) {
    console.error('Error marking attendance:', error);
    throw error;
  }
}

/**
 * Create a temporary student (via Cloud Function for security)
 */
export async function createTempStudent(linkToken, studentData) {
  try {
    const createTempStudentFunction = httpsCallable(functions, 'createTempStudent');
    const result = await createTempStudentFunction({
      linkToken,
      studentData
    });
    return result.data;
  } catch (error) {
    console.error('Error creating temp student:', error);
    throw error;
  }
}

/**
 * Create validated teacher session (via Cloud Function for security)
 */
export async function createTeacherSession(linkToken, uid) {
  try {
    const createTeacherSessionFunction = httpsCallable(functions, 'createTeacherSession');
    const result = await createTeacherSessionFunction({
      linkToken,
      uid
    });
    return result.data;
  } catch (error) {
    console.error('Error creating teacher session:', error);
    throw error;
  }
}

/**
 * Renew teacher session (extends expiration)
 */
export async function renewTeacherSession(linkToken, uid) {
  try {
    const renewTeacherSessionFunction = httpsCallable(functions, 'renewTeacherSession');
    const result = await renewTeacherSessionFunction({
      linkToken,
      uid
    });
    return result.data;
  } catch (error) {
    console.error('Error renewing teacher session:', error);
    throw error;
  }
}
