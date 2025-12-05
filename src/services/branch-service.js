/**
 * Branch Service
 * Handles CRUD operations for branches
 */

import { db } from '../config/firebase-config.js';
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

/**
 * Get all branches for a business
 */
export async function getAllBranches(businessId, options = {}) {
  try {
    const branchesRef = collection(db, `businesses/${businessId}/branches`);
    let q = branchesRef;

    if (options.isActive !== undefined) {
      q = query(q, where('isActive', '==', options.isActive));
    }

    q = query(q, orderBy('name', 'asc'));

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting branches:', error);
    throw error;
  }
}

/**
 * Get branch by ID
 */
export async function getBranchById(businessId, branchId) {
  try {
    const branchDoc = await getDoc(doc(db, `businesses/${businessId}/branches`, branchId));
    
    if (!branchDoc.exists()) {
      throw new Error('Branch not found');
    }

    return {
      id: branchDoc.id,
      ...branchDoc.data()
    };
  } catch (error) {
    console.error('Error getting branch:', error);
    throw error;
  }
}

/**
 * Create new branch
 */
export async function createBranch(businessId, branchData) {
  try {
    const branchesRef = collection(db, `businesses/${businessId}/branches`);
    
    const newBranch = {
      name: branchData.name,
      shortName: branchData.shortName,
      city: branchData.city,
      phone: branchData.phone,
      address: branchData.address,
      managerEmail: branchData.managerEmail,
      branchEmail: branchData.branchEmail,
      isActive: branchData.isActive !== undefined ? branchData.isActive : true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const docRef = await addDoc(branchesRef, newBranch);

    return {
      id: docRef.id,
      ...newBranch
    };
  } catch (error) {
    console.error('Error creating branch:', error);
    throw error;
  }
}

/**
 * Update existing branch
 */
export async function updateBranch(businessId, branchId, branchData) {
  try {
    const branchRef = doc(db, `businesses/${businessId}/branches`, branchId);
    
    const updateData = {
      name: branchData.name,
      shortName: branchData.shortName,
      city: branchData.city,
      phone: branchData.phone,
      address: branchData.address,
      managerEmail: branchData.managerEmail,
      branchEmail: branchData.branchEmail,
      isActive: branchData.isActive,
      updatedAt: serverTimestamp()
    };

    await updateDoc(branchRef, updateData);

    return {
      id: branchId,
      ...updateData
    };
  } catch (error) {
    console.error('Error updating branch:', error);
    throw error;
  }
}

/**
 * Delete branch
 */
export async function deleteBranch(businessId, branchId) {
  try {
    const branchRef = doc(db, `businesses/${businessId}/branches`, branchId);
    await deleteDoc(branchRef);
  } catch (error) {
    console.error('Error deleting branch:', error);
    throw error;
  }
}

/**
 * Toggle branch active status
 */
export async function toggleBranchActive(businessId, branchId) {
  try {
    const branchRef = doc(db, `businesses/${businessId}/branches`, branchId);
    const branchDoc = await getDoc(branchRef);
    
    if (!branchDoc.exists()) {
      throw new Error('Branch not found');
    }

    const currentStatus = branchDoc.data().isActive;
    await updateDoc(branchRef, {
      isActive: !currentStatus,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error toggling branch:', error);
    throw error;
  }
}
