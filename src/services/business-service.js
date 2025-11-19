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
  Timestamp
} from 'firebase/firestore';

/**
 * Business Service
 * Handles CRUD operations for businesses
 */

/**
 * Get all businesses (SuperAdmin only)
 * @returns {Promise<Array>} Array of businesses
 */
export async function getAllBusinesses() {
  try {
    const businessesRef = collection(db, 'studios');
    const q = query(businessesRef, orderBy('name'));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting businesses:', error);
    throw error;
  }
}

/**
 * Get business by ID
 * @param {string} businessId - Business ID
 * @returns {Promise<object|null>} Business data or null
 */
export async function getBusinessById(businessId) {
  try {
    const businessDoc = await getDoc(doc(db, 'studios', businessId));
    
    if (!businessDoc.exists()) {
      return null;
    }
    
    return {
      id: businessDoc.id,
      ...businessDoc.data()
    };
  } catch (error) {
    console.error('Error getting business:', error);
    throw error;
  }
}

/**
 * Create a new business
 * @param {object} businessData - Business data
 * @returns {Promise<string>} New business ID
 */
export async function createBusiness(businessData) {
  try {
    const newBusiness = {
      name: businessData.name,
      managerName: businessData.managerName || '',
      managerPhone: businessData.managerPhone || '',
      contactPhone: businessData.contactPhone || '',
      idNumber: businessData.idNumber || '',
      address: businessData.address || '',
      email: businessData.email || '',
      isActive: true,
      settings: businessData.settings || {},
      createdAt: Timestamp.now()
    };
    
    const docRef = await addDoc(collection(db, 'studios'), newBusiness);
    return docRef.id;
  } catch (error) {
    console.error('Error creating business:', error);
    throw error;
  }
}

/**
 * Update business
 * @param {string} businessId - Business ID
 * @param {object} updates - Data to update
 * @returns {Promise<void>}
 */
export async function updateBusiness(businessId, updates) {
  try {
    const businessRef = doc(db, 'studios', businessId);
    await updateDoc(businessRef, updates);
  } catch (error) {
    console.error('Error updating business:', error);
    throw error;
  }
}

/**
 * Delete business (soft delete - set isActive to false)
 * @param {string} businessId - Business ID
 * @returns {Promise<void>}
 */
export async function deleteBusiness(businessId) {
  try {
    await updateBusiness(businessId, { isActive: false });
  } catch (error) {
    console.error('Error deleting business:', error);
    throw error;
  }
}

/**
 * Activate business
 * @param {string} businessId - Business ID
 * @returns {Promise<void>}
 */
export async function activateBusiness(businessId) {
  try {
    await updateBusiness(businessId, { isActive: true });
  } catch (error) {
    console.error('Error activating business:', error);
    throw error;
  }
}

/**
 * Get active businesses
 * @returns {Promise<Array>} Array of active businesses
 */
export async function getActiveBusinesses() {
  try {
    const businessesRef = collection(db, 'studios');
    const q = query(
      businessesRef, 
      where('isActive', '==', true),
      orderBy('name')
    );
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting active businesses:', error);
    throw error;
  }
}

/**
 * Update business settings
 * @param {string} businessId - Business ID
 * @param {object} settings - Settings object
 * @returns {Promise<void>}
 */
export async function updateBusinessSettings(businessId, settings) {
  try {
    await updateBusiness(businessId, { settings });
  } catch (error) {
    console.error('Error updating business settings:', error);
    throw error;
  }
}

/**
 * Get business statistics
 * @param {string} businessId - Business ID
 * @returns {Promise<object>} Business statistics
 */
export async function getBusinessStats(businessId) {
  try {
    // Get counts from subcollections
    const [students, teachers, classTemplates] = await Promise.all([
      getDocs(collection(db, `studios/${businessId}/students`)),
      getDocs(collection(db, `studios/${businessId}/teachers`)),
      getDocs(collection(db, `studios/${businessId}/classTemplates`))
    ]);
    
    return {
      totalStudents: students.size,
      totalTeachers: teachers.size,
      totalClasses: classTemplates.size,
      activeStudents: students.docs.filter(doc => doc.data().isActive).length,
      activeTeachers: teachers.docs.filter(doc => doc.data().isActive).length
    };
  } catch (error) {
    console.error('Error getting business stats:', error);
    throw error;
  }
}
