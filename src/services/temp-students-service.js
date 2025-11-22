/**
 * Temp Students Service
 * Handles temporary student records created by teachers
 * These students can attend classes but are not enrolled in courses
 */

import { db } from '../config/firebase-config.js';
import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp
} from 'firebase/firestore';

/**
 * Check if phone number already exists in temp students or permanent students
 * @param {string} businessId - Business ID
 * @param {string} phone - Phone number to check
 * @returns {Promise<{exists: boolean, studentName: string|null, isTemp: boolean}>}
 */
export async function checkDuplicatePhoneForTempStudent(businessId, phone) {
  try {
    // Check temp students
    const tempStudentsQuery = query(
      collection(db, 'tempStudents'),
      where('businessId', '==', businessId),
      where('phone', '==', phone),
      where('active', '==', true)
    );
    const tempSnapshot = await getDocs(tempStudentsQuery);
    
    if (!tempSnapshot.empty) {
      const tempStudent = tempSnapshot.docs[0].data();
      return {
        exists: true,
        studentName: tempStudent.name,
        isTemp: true
      };
    }

    // Check permanent students
    const studentsRef = collection(db, `businesses/${businessId}/students`);
    const studentsQuery = query(studentsRef, where('phone', '==', phone));
    const studentsSnapshot = await getDocs(studentsQuery);
    
    if (!studentsSnapshot.empty) {
      const student = studentsSnapshot.docs[0].data();
      const fullName = `${student.firstName} ${student.lastName}`.trim();
      return {
        exists: true,
        studentName: fullName,
        isTemp: false
      };
    }

    return { exists: false, studentName: null, isTemp: false };
  } catch (error) {
    console.error('Error checking duplicate phone for temp student:', error);
    throw error;
  }
}

/**
 * Create a new temp student
 * @param {Object} tempStudentData - { name, phone, notes, classId, businessId }
 * @param {string} createdBy - User ID of teacher who created it
 * @returns {Promise<string>} Temp student ID
 */
export async function createTempStudent(tempStudentData, createdBy) {
  try {
    const docRef = await addDoc(collection(db, 'tempStudents'), {
      ...tempStudentData,
      createdBy,
      createdAt: Timestamp.now(),
      active: true
    });
    return docRef.id;
  } catch (error) {
    console.error('Error creating temp student:', error);
    throw error;
  }
}

/**
 * Get temp student by ID
 * @param {string} tempStudentId - Temp student ID
 * @returns {Promise<Object|null>} Temp student data or null
 */
export async function getTempStudentById(tempStudentId) {
  try {
    const docRef = doc(db, 'tempStudents', tempStudentId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (error) {
    console.error('Error getting temp student:', error);
    throw error;
  }
}

/**
 * Get all temp students for a business
 * @param {string} businessId - Business ID
 * @returns {Promise<Array>} List of temp students
 */
export async function getTempStudentsByBusiness(businessId) {
  try {
    const q = query(
      collection(db, 'tempStudents'),
      where('businessId', '==', businessId),
      where('active', '==', true),
      orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting temp students:', error);
    throw error;
  }
}

/**
 * Get temp students for a specific class
 * @param {string} classId - Class ID
 * @returns {Promise<Array>} Array of temp students
 */
export async function getTempStudentsByClass(classId) {
  try {
    const q = query(
      collection(db, 'tempStudents'),
      where('classId', '==', classId),
      where('active', '==', true)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting temp students for class:', error);
    throw error;
  }
}

/**
 * Update temp student
 * @param {string} tempStudentId - Temp student ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<void>}
 */
export async function updateTempStudent(tempStudentId, updates) {
  try {
    const docRef = doc(db, 'tempStudents', tempStudentId);
    await updateDoc(docRef, updates);
  } catch (error) {
    console.error('Error updating temp student:', error);
    throw error;
  }
}

/**
 * Delete temp student (soft delete)
 * @param {string} tempStudentId - Temp student ID
 * @returns {Promise<void>}
 */
export async function deleteTempStudent(tempStudentId) {
  try {
    const docRef = doc(db, 'tempStudents', tempStudentId);
    await updateDoc(docRef, { active: false });
  } catch (error) {
    console.error('Error deleting temp student:', error);
    throw error;
  }
}

/**
 * Convert temp student to real student
 * Creates a student record and optionally enrolls in a course
 * @param {string} tempStudentId - Temp student ID
 * @param {Object} additionalData - Additional student data (email, dateOfBirth, etc.)
 * @param {string} courseId - Optional course ID to enroll in
 * @returns {Promise<string>} New student ID
 */
export async function convertTempStudentToStudent(tempStudentId, additionalData = {}) {
  try {
    const tempStudent = await getTempStudentById(tempStudentId);
    if (!tempStudent) {
      throw new Error('Temp student not found');
    }

    // Import student service dynamically to avoid circular dependencies
    const { createStudent } = await import('./student-service.js');
    
    // Get the businessId from the temp student (stored as businessId)
    const businessId = tempStudent.businessId;
    
    // Create real student with temp student data
    const studentData = {
      firstName: tempStudent.name.split(' ')[0] || tempStudent.name,
      lastName: tempStudent.name.split(' ').slice(1).join(' ') || '',
      phone: tempStudent.phone,
      notes: tempStudent.notes || '',
      ...additionalData
    };
    
    const result = await createStudent(businessId, studentData);
    const studentId = result.id;

    // Mark temp student as converted
    await updateDoc(doc(db, 'tempStudents', tempStudentId), {
      active: false,
      convertedToStudentId: studentId,
      convertedAt: Timestamp.now()
    });

    return studentId;
  } catch (error) {
    console.error('Error converting temp student:', error);
    throw error;
  }
}
