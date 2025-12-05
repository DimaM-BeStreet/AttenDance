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
  limit,
  startAfter,
  serverTimestamp
} from 'firebase/firestore';

/**
 * Class Template Service
 * Handles recurring class templates that generate instances
 */

/**
 * Get all class templates for a business (legacy - use getPaginatedClassTemplates for better performance)
 */
export async function getAllClassTemplates(businessId, options = {}) {
  try {
    const templatesRef = collection(db, `businesses/${businessId}/classTemplates`);
    let constraints = [];

    if (options.branchId) {
      constraints.push(where('branchId', '==', options.branchId));
    }

    if (options.isActive !== undefined) {
      constraints.push(where('isActive', '==', options.isActive));
    }

    if (options.teacherId) {
      constraints.push(where('teacherId', '==', options.teacherId));
    }

    const sortField = options.sortBy || 'name';
    constraints.push(orderBy(sortField));
    
    let q = query(templatesRef, ...constraints);

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting class templates:', error);
    throw error;
  }
}

/**
 * Get paginated class templates with cursor-based pagination
 * @param {string} businessId - Business ID
 * @param {object} options - Query options
 * @param {number} options.limit - Number of items per page (default: 20)
 * @param {DocumentSnapshot} options.startAfterDoc - Last document from previous page
 * @param {string} options.branchId - Filter by branch
 * @param {boolean} options.isActive - Filter by active status
 * @param {string} options.teacherId - Filter by teacher
 * @param {string} options.sortBy - Field to sort by (default: 'name')
 * @param {string} options.sortOrder - Sort order 'asc' or 'desc' (default: 'asc')
 * @returns {Promise<{templates: Array, lastDoc: DocumentSnapshot, hasMore: boolean}>}
 */
export async function getPaginatedClassTemplates(businessId, options = {}) {
  try {
    const templatesRef = collection(db, `businesses/${businessId}/classTemplates`);
    const pageLimit = options.limit || 20;
    let constraints = [];

    if (options.branchId) {
      constraints.push(where('branchId', '==', options.branchId));
    }

    if (options.isActive !== undefined) {
      constraints.push(where('isActive', '==', options.isActive));
    }

    if (options.teacherId) {
      constraints.push(where('teacherId', '==', options.teacherId));
    }

    const sortField = options.sortBy || 'name';
    const sortOrder = options.sortOrder || 'asc';
    constraints.push(orderBy(sortField, sortOrder));

    if (options.startAfterDoc) {
      constraints.push(startAfter(options.startAfterDoc));
    }

    constraints.push(limit(pageLimit + 1));

    const q = query(templatesRef, ...constraints);
    const snapshot = await getDocs(q);
    
    const docs = snapshot.docs;
    const hasMore = docs.length > pageLimit;
    const templates = docs.slice(0, pageLimit).map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    const lastDoc = hasMore ? docs[pageLimit - 1] : (docs.length > 0 ? docs[docs.length - 1] : null);

    return {
      templates,
      lastDoc,
      hasMore,
      total: templates.length
    };
  } catch (error) {
    console.error('Error getting paginated class templates:', error);
    throw error;
  }
}

/**
 * Get single class template by ID
 */
export async function getClassTemplateById(businessId, templateId) {
  try {
    const templateDoc = await getDoc(doc(db, `businesses/${businessId}/classTemplates`, templateId));
    
    if (!templateDoc.exists()) {
      throw new Error('Class template not found');
    }

    return {
      id: templateDoc.id,
      ...templateDoc.data()
    };
  } catch (error) {
    console.error('Error getting class template:', error);
    throw error;
  }
}

/**
 * Create new class template
 */
export async function createClassTemplate(businessId, templateData) {
  try {
    const templatesRef = collection(db, `businesses/${businessId}/classTemplates`);
    
    const newTemplate = {
      name: templateData.name,
      branchId: templateData.branchId || null,
      teacherId: templateData.teacherId || null,
      dayOfWeek: templateData.dayOfWeek, // 0 = Sunday, 6 = Saturday
      startTime: templateData.startTime, // Format: "HH:mm"
      duration: templateData.duration, // in minutes
      locationId: templateData.locationId || '',
      whatsappLink: templateData.whatsappLink || '',
      isActive: templateData.isActive !== false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const docRef = await addDoc(templatesRef, newTemplate);

    return {
      id: docRef.id,
      ...newTemplate
    };
  } catch (error) {
    console.error('Error creating class template:', error);
    throw error;
  }
}

/**
 * Update class template
 */
export async function updateClassTemplate(businessId, templateId, templateData) {
  try {
    const templateRef = doc(db, `businesses/${businessId}/classTemplates`, templateId);

    const updates = {
      ...templateData,
      updatedAt: serverTimestamp()
    };

    await updateDoc(templateRef, updates);

    return {
      id: templateId,
      ...updates
    };
  } catch (error) {
    console.error('Error updating class template:', error);
    throw error;
  }
}

/**
 * Delete class template (soft delete)
 */
export async function deleteClassTemplate(businessId, templateId) {
  try {
    const templateRef = doc(db, `businesses/${businessId}/classTemplates`, templateId);
    
    await updateDoc(templateRef, {
      isActive: false,
      deletedAt: serverTimestamp()
    });

    return true;
  } catch (error) {
    console.error('Error deleting class template:', error);
    throw error;
  }
}

/**
 * Get enrolled students count for template
 */
export async function getTemplateEnrollmentCount(businessId, templateId) {
  try {
    const template = await getClassTemplateById(businessId, templateId);
    return (template.defaultStudentIds || []).length;
  } catch (error) {
    console.error('Error getting template enrollment count:', error);
    throw error;
  }
}

/**
 * Get template with enriched data (teacher name, style name, enrollment count)
 */
export async function getEnrichedClassTemplate(businessId, templateId) {
  try {
    const template = await getClassTemplateById(businessId, templateId);
    
    // Get teacher info
    if (template.teacherId) {
      const teacherDoc = await getDoc(doc(db, `businesses/${businessId}/teachers`, template.teacherId));
      if (teacherDoc.exists()) {
        const teacher = teacherDoc.data();
        template.teacherName = `${teacher.firstName} ${teacher.lastName}`;
      }
    }

    template.enrollmentCount = await getTemplateEnrollmentCount(businessId, templateId);

    return template;
  } catch (error) {
    console.error('Error getting enriched class template:', error);
    throw error;
  }
}

/**
 * Get all enriched templates
 */
export async function getAllEnrichedClassTemplates(businessId, options = {}) {
  try {
    const templates = await getAllClassTemplates(businessId, options);
    
    // Enrich each template
    const enrichedTemplates = await Promise.all(
      templates.map(template => getEnrichedClassTemplate(businessId, template.id))
    );

    return enrichedTemplates;
  } catch (error) {
    console.error('Error getting enriched class templates:', error);
    throw error;
  }
}

/**
 * Get template instances (generated classes from this template)
 */
export async function getTemplateInstances(businessId, templateId, options = {}) {
  try {
    const instancesRef = collection(db, `businesses/${businessId}/classInstances`);
    let q = query(instancesRef, where('templateId', '==', templateId));

    if (options.startDate) {
      q = query(q, where('date', '>=', options.startDate));
    }

    if (options.endDate) {
      q = query(q, where('date', '<=', options.endDate));
    }

    q = query(q, orderBy('date', options.sortOrder || 'asc'));

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting template instances:', error);
    throw error;
  }
}

/**
 * Duplicate class template
 */
export async function duplicateClassTemplate(businessId, templateId) {
  try {
    const originalTemplate = await getClassTemplateById(businessId, templateId);
    
    // Remove ID and timestamps
    const { id, createdAt, updatedAt, ...templateData } = originalTemplate;
    
    // Add "Copy" to name
    templateData.name = `${templateData.name} (Copy)`;
    
    return await createClassTemplate(businessId, templateData);
  } catch (error) {
    console.error('Error duplicating class template:', error);
    throw error;
  }
}

/**
 * Search class templates by name (prefix search)
 */
export async function searchClassTemplates(businessId, searchTerm) {
  try {
    const templatesRef = collection(db, `businesses/${businessId}/classTemplates`);
    // Firestore prefix search
    const q = query(
      templatesRef, 
      where('name', '>=', searchTerm),
      where('name', '<=', searchTerm + '\uf8ff'),
      where('isActive', '==', true),
      limit(10)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error searching class templates:', error);
    return [];
  }
}


