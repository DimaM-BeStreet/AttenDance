/**
 * Location Service
 * Handles all location/space-related operations
 */

import { db } from '../config/firebase-config.js';
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  getDoc,
  query,
  where,
  orderBy,
  Timestamp 
} from 'firebase/firestore';

/**
 * Get all locations for a business
 * @param {string} businessId - Business ID
 * @param {Object} filters - Optional filters
 * @returns {Promise<Array>} Array of locations with IDs
 */
export async function getAllLocations(businessId, filters = {}) {
  try {
    const locationsRef = collection(db, 'businesses', businessId, 'locations');
    let constraints = [];

    // Apply branch filter
    if (filters.branchId) {
      constraints.push(where('branchId', '==', filters.branchId));
    }

    // Apply active filter
    if (filters.isActive !== undefined) {
      constraints.push(where('isActive', '==', filters.isActive));
    }

    constraints.push(orderBy('name', 'asc'));
    let q = query(locationsRef, ...constraints);

    const snapshot = await getDocs(q);
    const locations = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return locations;
  } catch (error) {
    console.error('Error getting locations:', error);
    throw error;
  }
}

/**
 * Get a specific location by ID
 * @param {string} businessId - Business ID
 * @param {string} locationId - Location ID
 * @returns {Promise<Object>} Location data with ID
 */
export async function getLocationById(businessId, locationId) {
  try {
    const locationRef = doc(db, 'businesses', businessId, 'locations', locationId);
    const locationSnap = await getDoc(locationRef);

    if (!locationSnap.exists()) {
      throw new Error('Location not found');
    }

    return {
      id: locationSnap.id,
      ...locationSnap.data()
    };
  } catch (error) {
    console.error('Error getting location:', error);
    throw error;
  }
}

/**
 * Create a new location
 * @param {string} businessId - Business ID
 * @param {Object} locationData - Location data
 * @returns {Promise<string>} New location ID
 */
export async function createLocation(businessId, locationData) {
  try {
    const locationsRef = collection(db, 'businesses', businessId, 'locations');

    const newLocation = {
      name: locationData.name,
      branchId: locationData.branchId || null,
      maxStudents: locationData.maxStudents || 20,
      description: locationData.description || '',
      isActive: locationData.isActive !== undefined ? locationData.isActive : true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };

    const docRef = await addDoc(locationsRef, newLocation);
    console.log('Location created:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error creating location:', error);
    throw error;
  }
}

/**
 * Update an existing location
 * @param {string} businessId - Business ID
 * @param {string} locationId - Location ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<void>}
 */
export async function updateLocation(businessId, locationId, updates) {
  try {
    const locationRef = doc(db, 'businesses', businessId, 'locations', locationId);

    const updateData = {
      ...updates,
      updatedAt: Timestamp.now()
    };

    await updateDoc(locationRef, updateData);
    console.log('Location updated:', locationId);
  } catch (error) {
    console.error('Error updating location:', error);
    throw error;
  }
}

/**
 * Delete a location
 * @param {string} businessId - Business ID
 * @param {string} locationId - Location ID
 * @returns {Promise<void>}
 */
export async function deleteLocation(businessId, locationId) {
  try {
    // Check if location is used by any templates
    const templatesRef = collection(db, 'businesses', businessId, 'classTemplates');
    const templatesQuery = query(templatesRef, where('locationId', '==', locationId));
    const templatesSnapshot = await getDocs(templatesQuery);

    if (!templatesSnapshot.empty) {
      throw new Error('Cannot delete location: it is being used by class templates');
    }

    const locationRef = doc(db, 'businesses', businessId, 'locations', locationId);
    await deleteDoc(locationRef);
    console.log('Location deleted:', locationId);
  } catch (error) {
    console.error('Error deleting location:', error);
    throw error;
  }
}

/**
 * Toggle location active status
 * @param {string} businessId - Business ID
 * @param {string} locationId - Location ID
 * @returns {Promise<boolean>} New active status
 */
export async function toggleLocationActive(businessId, locationId) {
  try {
    const location = await getLocationById(businessId, locationId);
    const newActiveStatus = !location.isActive;

    await updateLocation(businessId, locationId, {
      isActive: newActiveStatus
    });

    return newActiveStatus;
  } catch (error) {
    console.error('Error toggling location active status:', error);
    throw error;
  }
}
