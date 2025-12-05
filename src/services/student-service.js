import { db, storage } from '@config/firebase-config';
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
import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';

/**
 * Student Service
 * Handles all student-related operations including CRUD and photo management
 */

/**
 * Get all students for a business (legacy - use getPaginatedStudents for better performance)
 */
export async function getAllStudents(businessId, options = {}) {
  try {
    const studentsRef = collection(db, `businesses/${businessId}/students`);
    let q = studentsRef;

    // Apply filters
    if (options.isActive !== undefined) {
      q = query(q, where('isActive', '==', options.isActive));
    }
    
    if (options.isComplete !== undefined) {
      q = query(q, where('isComplete', '==', options.isComplete));
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
    console.error('Error getting students:', error);
    throw error;
  }
}

/**
 * Get paginated students with cursor-based pagination
 * @param {string} businessId - Business ID
 * @param {object} options - Query options
 * @param {number} options.limit - Number of items per page (default: 20)
 * @param {DocumentSnapshot} options.startAfterDoc - Last document from previous page
 * @param {boolean} options.isActive - Filter by active status
 * @param {string} options.sortBy - Field to sort by (default: 'firstName')
 * @param {string} options.sortOrder - Sort order 'asc' or 'desc' (default: 'asc')
 * @returns {Promise<{students: Array, lastDoc: DocumentSnapshot, hasMore: boolean}>}
 */
export async function getPaginatedStudents(businessId, options = {}) {
  try {
    const studentsRef = collection(db, `businesses/${businessId}/students`);
    const pageLimit = options.limit || 20;
    let constraints = [];

    // Apply filters
    if (options.isActive !== undefined) {
      constraints.push(where('isActive', '==', options.isActive));
    }
    
    if (options.isComplete !== undefined) {
      constraints.push(where('isComplete', '==', options.isComplete));
    }

    // Apply sorting
    const sortField = options.sortBy || 'firstName';
    const sortOrder = options.sortOrder || 'asc';
    constraints.push(orderBy(sortField, sortOrder));

    // Add pagination
    if (options.startAfterDoc) {
      constraints.push(startAfter(options.startAfterDoc));
    }
    
    // Request one extra to check if there are more pages
    constraints.push(limit(pageLimit + 1));

    const q = query(studentsRef, ...constraints);
    const snapshot = await getDocs(q);
    
    const docs = snapshot.docs;
    const hasMore = docs.length > pageLimit;
    const students = docs.slice(0, pageLimit).map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    const lastDoc = hasMore ? docs[pageLimit - 1] : (docs.length > 0 ? docs[docs.length - 1] : null);

    return {
      students,
      lastDoc,
      hasMore,
      total: students.length
    };
  } catch (error) {
    console.error('Error getting paginated students:', error);
    throw error;
  }
}

/**
 * Get single student by ID
 */
export async function getStudentById(businessId, studentId) {
  try {
    const studentDoc = await getDoc(doc(db, `businesses/${businessId}/students`, studentId));
    
    if (!studentDoc.exists()) {
      throw new Error('Student not found');
    }

    return {
      id: studentDoc.id,
      ...studentDoc.data()
    };
  } catch (error) {
    console.error('Error getting student:', error);
    throw error;
  }
}

/**
 * Search students by name, phone, or ID number
 */
export async function searchStudents(businessId, searchTerm) {
  try {
    const allStudents = await getAllStudents(businessId);
    const term = searchTerm.toLowerCase();

    return allStudents.filter(student => {
      const fullName = `${student.firstName} ${student.lastName}`.toLowerCase();
      const phone = student.phone || '';
      const idNumber = student.idNumber || '';
      
      return fullName.includes(term) || 
             phone.includes(term) || 
             idNumber.includes(term);
    });
  } catch (error) {
    console.error('Error searching students:', error);
    throw error;
  }
}

/**
 * Upload student photo to Firebase Storage
 */
export async function uploadStudentPhoto(businessId, studentId, file) {
  try {
    // Create storage reference
    const photoRef = ref(storage, `businesses/${businessId}/students/${studentId}/profile.jpg`);
    
    // Upload file
    await uploadBytes(photoRef, file);
    
    // Get download URL
    const photoURL = await getDownloadURL(photoRef);
    
    return photoURL;
  } catch (error) {
    console.error('Error uploading student photo:', error);
    throw error;
  }
}

/**
 * Delete student photo from Firebase Storage
 */
export async function deleteStudentPhoto(businessId, studentId) {
  try {
    const photoRef = ref(storage, `businesses/${businessId}/students/${studentId}/profile.jpg`);
    await deleteObject(photoRef);
  } catch (error) {
    // Ignore error if file doesn't exist
    if (error.code !== 'storage/object-not-found') {
      console.error('Error deleting student photo:', error);
      throw error;
    }
  }
}

/**
 * Check if phone number already exists
 */
export async function checkDuplicatePhone(businessId, phone, excludeStudentId = null) {
  try {
    const studentsRef = collection(db, `businesses/${businessId}/students`);
    const q = query(studentsRef, where('phone', '==', phone));
    const snapshot = await getDocs(q);
    
    // If excluding a student (for updates), filter out that student
    if (excludeStudentId) {
      return snapshot.docs.some(doc => doc.id !== excludeStudentId);
    }
    
    return !snapshot.empty;
  } catch (error) {
    console.error('Error checking duplicate phone:', error);
    throw error;
  }
}

/**
 * Check if email already exists
 */
export async function checkDuplicateEmail(businessId, email, excludeStudentId = null) {
  try {
    if (!email) return false; // Email is optional
    
    const studentsRef = collection(db, `businesses/${businessId}/students`);
    const q = query(studentsRef, where('email', '==', email));
    const snapshot = await getDocs(q);
    
    // If excluding a student (for updates), filter out that student
    if (excludeStudentId) {
      return snapshot.docs.some(doc => doc.id !== excludeStudentId);
    }
    
    return !snapshot.empty;
  } catch (error) {
    console.error('Error checking duplicate email:', error);
    throw error;
  }
}

/**
 * Create new student
 */
export async function createStudent(businessId, studentData, photoFile = null) {
  try {
    // Check for duplicate phone number
    if (studentData.phone) {
      const isDuplicate = await checkDuplicatePhone(businessId, studentData.phone);
      if (isDuplicate) {
        throw new Error('תלמיד עם מספר טלפון זה כבר קיים במערכת');
      }
    }
    
    // Check for duplicate email
    if (studentData.email) {
      const isDuplicate = await checkDuplicateEmail(businessId, studentData.email);
      if (isDuplicate) {
        throw new Error('תלמיד עם כתובת אימייל זו כבר קיים במערכת');
      }
    }
    
    const studentsRef = collection(db, `businesses/${businessId}/students`);
    
    // Prepare student data
    const newStudent = {
      ...studentData,
      isActive: true,
      isComplete: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    // Create student document
    const docRef = await addDoc(studentsRef, newStudent);
    const studentId = docRef.id;

    // Upload photo if provided
    if (photoFile) {
      const photoURL = await uploadStudentPhoto(businessId, studentId, photoFile);
      await updateDoc(docRef, { photoURL });
      newStudent.photoURL = photoURL;
    }

    return {
      id: studentId,
      ...newStudent
    };
  } catch (error) {
    console.error('Error creating student:', error);
    throw error;
  }
}

/**
 * Update student
 */
export async function updateStudent(businessId, studentId, studentData, photoFile = null) {
  try {
    // Check for duplicate phone number (excluding current student)
    if (studentData.phone) {
      const isDuplicate = await checkDuplicatePhone(businessId, studentData.phone, studentId);
      if (isDuplicate) {
        throw new Error('תלמיד אחר עם מספר טלפון זה כבר קיים במערכת');
      }
    }
    
    // Check for duplicate email (excluding current student)
    if (studentData.email) {
      const isDuplicate = await checkDuplicateEmail(businessId, studentData.email, studentId);
      if (isDuplicate) {
        throw new Error('תלמיד אחר עם כתובת אימייל זו כבר קיים במערכת');
      }
    }
    
    const studentRef = doc(db, `businesses/${businessId}/students`, studentId);

    // Update student data
    const updates = {
      ...studentData,
      updatedAt: serverTimestamp()
    };

    // Handle photo update
    if (photoFile) {
      // Delete old photo if exists
      try {
        await deleteStudentPhoto(businessId, studentId);
      } catch (error) {
        // Ignore if no existing photo
      }
      
      // Upload new photo
      const photoURL = await uploadStudentPhoto(businessId, studentId, photoFile);
      updates.photoURL = photoURL;
    }

    await updateDoc(studentRef, updates);

    return {
      id: studentId,
      ...updates
    };
  } catch (error) {
    console.error('Error updating student:', error);
    throw error;
  }
}

/**
 * Delete student (soft delete)
 */
export async function deleteStudent(businessId, studentId) {
  try {
    const studentRef = doc(db, `businesses/${businessId}/students`, studentId);
    
    await updateDoc(studentRef, {
      isActive: false,
      deletedAt: serverTimestamp()
    });

    return true;
  } catch (error) {
    console.error('Error deleting student:', error);
    throw error;
  }
}

/**
 * Permanently delete student and all data
 * Keeps historical attendance records but removes future enrollments
 */
export async function permanentlyDeleteStudent(businessId, studentId) {
  try {
    // 1. Delete photo from storage
    await deleteStudentPhoto(businessId, studentId);
    
    // 2. Delete all course enrollments
    const enrollmentsRef = collection(db, `businesses/${businessId}/enrollments`);
    const enrollmentsQuery = query(enrollmentsRef, where('studentId', '==', studentId));
    const enrollmentsSnapshot = await getDocs(enrollmentsQuery);
    
    const enrollmentDeletes = enrollmentsSnapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(enrollmentDeletes);
    
    // 3. Remove student from future class instances (date >= today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const classInstancesRef = collection(db, `businesses/${businessId}/classInstances`);
    const futureInstancesQuery = query(
      classInstancesRef, 
      where('date', '>=', today)
    );
    const futureInstancesSnapshot = await getDocs(futureInstancesQuery);
    
    const instanceUpdates = futureInstancesSnapshot.docs
      .filter(doc => {
        const attendance = doc.data().attendance || {};
        return studentId in attendance;
      })
      .map(doc => {
        const data = doc.data();
        const attendance = { ...data.attendance };
        delete attendance[studentId];
        return updateDoc(doc.ref, { attendance });
      });
    
    await Promise.all(instanceUpdates);
    
    // 4. Delete student document
    await deleteDoc(doc(db, `businesses/${businessId}/students`, studentId));

    return true;
  } catch (error) {
    console.error('Error permanently deleting student:', error);
    throw error;
  }
}

/**
 * Mark student as complete/incomplete
 */
export async function updateStudentCompleteStatus(businessId, studentId, isComplete) {
  try {
    const studentRef = doc(db, `businesses/${businessId}/students`, studentId);
    
    await updateDoc(studentRef, {
      isComplete,
      updatedAt: serverTimestamp()
    });

    return true;
  } catch (error) {
    console.error('Error updating student complete status:', error);
    throw error;
  }
}

/**
 * Get student enrollments
 */
export async function getStudentEnrollments(businessId, studentId) {
  try {
    const enrollmentsRef = collection(db, `businesses/${businessId}/enrollments`);
    const q = query(enrollmentsRef, where('studentId', '==', studentId));
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting student enrollments:', error);
    throw error;
  }
}

/**
 * Get student attendance records
 */
export async function getStudentAttendance(businessId, studentId, options = {}) {
  try {
    const attendanceRef = collection(db, `businesses/${businessId}/attendance`);
    let q = query(attendanceRef, where('studentId', '==', studentId));

    // Add date range filter if provided
    if (options.startDate) {
      q = query(q, where('date', '>=', Timestamp.fromDate(options.startDate)));
    }
    if (options.endDate) {
      q = query(q, where('date', '<=', Timestamp.fromDate(options.endDate)));
    }

    q = query(q, orderBy('date', 'desc'));

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting student attendance:', error);
    throw error;
  }
}

/**
 * Calculate student attendance statistics
 */
export async function getStudentAttendanceStats(businessId, studentId) {
  try {
    const attendance = await getStudentAttendance(businessId, studentId);
    
    const stats = {
      total: attendance.length,
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
      attendanceRate: 0
    };

    attendance.forEach(record => {
      stats[record.status] = (stats[record.status] || 0) + 1;
    });

    if (stats.total > 0) {
      stats.attendanceRate = ((stats.present + stats.late) / stats.total * 100).toFixed(1);
    }

    return stats;
  } catch (error) {
    console.error('Error calculating attendance stats:', error);
    throw error;
  }
}
