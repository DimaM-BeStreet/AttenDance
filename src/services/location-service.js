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
 * Get all locations for a studio
 * @param {string} studioId - Studio ID
 * @param {Object} filters - Optional filters
 * @returns {Promise<Array>} Array of locations with IDs
 */
export async function getAllLocations(studioId, filters = {}) {
  try {
    const locationsRef = collection(db, 'studios', studioId, 'locations');
    let q = query(locationsRef, orderBy('name', 'asc'));

    // Apply active filter
    if (filters.isActive !== undefined) {
      q = query(locationsRef, where('isActive', '==', filters.isActive), orderBy('name', 'asc'));
    }

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
 * @param {string} studioId - Studio ID
 * @param {string} locationId - Location ID
 * @returns {Promise<Object>} Location data with ID
 */
export async function getLocationById(studioId, locationId) {
  try {
    const locationRef = doc(db, 'studios', studioId, 'locations', locationId);
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
 * @param {string} studioId - Studio ID
 * @param {Object} locationData - Location data
 * @returns {Promise<string>} New location ID
 */
export async function createLocation(studioId, locationData) {
  try {
    const locationsRef = collection(db, 'studios', studioId, 'locations');

    const newLocation = {
      name: locationData.name,
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
 * @param {string} studioId - Studio ID
 * @param {string} locationId - Location ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<void>}
 */
export async function updateLocation(studioId, locationId, updates) {
  try {
    const locationRef = doc(db, 'studios', studioId, 'locations', locationId);

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
 * @param {string} studioId - Studio ID
 * @param {string} locationId - Location ID
 * @returns {Promise<void>}
 */
export async function deleteLocation(studioId, locationId) {
  try {
    // Check if location is used by any templates
    const templatesRef = collection(db, 'studios', studioId, 'classTemplates');
    const templatesQuery = query(templatesRef, where('locationId', '==', locationId));
    const templatesSnapshot = await getDocs(templatesQuery);

    if (!templatesSnapshot.empty) {
      throw new Error('Cannot delete location: it is being used by class templates');
    }

    const locationRef = doc(db, 'studios', studioId, 'locations', locationId);
    await deleteDoc(locationRef);
    console.log('Location deleted:', locationId);
  } catch (error) {
    console.error('Error deleting location:', error);
    throw error;
  }
}

/**
 * Toggle location active status
 * @param {string} studioId - Studio ID
 * @param {string} locationId - Location ID
 * @returns {Promise<boolean>} New active status
 */
export async function toggleLocationActive(studioId, locationId) {
  try {
    const location = await getLocationById(studioId, locationId);
    const newActiveStatus = !location.isActive;

    await updateLocation(studioId, locationId, {
      isActive: newActiveStatus
    });

    return newActiveStatus;
  } catch (error) {
    console.error('Error toggling location active status:', error);
    throw error;
  }
}
