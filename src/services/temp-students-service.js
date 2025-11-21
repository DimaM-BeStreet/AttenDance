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
 * Create a new temp student
 * @param {Object} tempStudentData - { name, phone, notes, classId, studioId }
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
 * Get all temp students for a studio
 * @param {string} studioId - Studio ID
 * @returns {Promise<Array>} Array of temp students
 */
export async function getTempStudentsByStudio(studioId) {
  try {
    const q = query(
      collection(db, 'tempStudents'),
      where('studioId', '==', studioId),
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
export async function convertTempStudentToStudent(tempStudentId, additionalData = {}, courseId = null) {
  try {
    const tempStudent = await getTempStudentById(tempStudentId);
    if (!tempStudent) {
      throw new Error('Temp student not found');
    }

    // Import student service dynamically to avoid circular dependencies
    const { createStudent } = await import('./student-service.js');
    
    // Create real student with temp student data
    const studentData = {
      firstName: tempStudent.name.split(' ')[0] || tempStudent.name,
      lastName: tempStudent.name.split(' ').slice(1).join(' ') || '',
      phone: tempStudent.phone,
      notes: tempStudent.notes || '',
      studioId: tempStudent.studioId,
      ...additionalData
    };
    
    const studentId = await createStudent(studentData);

    // If courseId provided, enroll student
    if (courseId) {
      const { enrollStudent } = await import('./course-service.js');
      await enrollStudent(courseId, studentId);
    }

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
