import { db } from '@config/firebase-config';
import { 
  collection, 
  query, 
  where, 
  getDocs,
  Timestamp
} from 'firebase/firestore';
import { 
  generateInstanceFromTemplate,
  getClassInstanceById,
  regenerateInstanceStudents
} from './class-instance-service.js';

/**
 * Instance Generation Service
 * Handles lazy generation and retrieval of class instances
 */

/**
 * Get or generate instance for a template on a specific date
 * If instance exists, return it. If not, generate it on-demand.
 */
export async function getOrGenerateInstance(businessId, templateId, date) {
  try {
    // Normalize date to start of day
    const checkDate = date instanceof Date ? new Date(date) : new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    
    const nextDay = new Date(checkDate);
    nextDay.setDate(nextDay.getDate() + 1);
    
    // Check if instance already exists
    const instancesRef = collection(db, `studios/${businessId}/classInstances`);
    const q = query(
      instancesRef,
      where('templateId', '==', templateId),
      where('date', '>=', Timestamp.fromDate(checkDate)),
      where('date', '<', Timestamp.fromDate(nextDay))
    );
    
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      // Instance exists, return it
      return {
        id: snapshot.docs[0].id,
        ...snapshot.docs[0].data()
      };
    }
    
    // Instance doesn't exist, generate it
    return await generateInstanceFromTemplate(businessId, templateId, checkDate);
  } catch (error) {
    console.error('Error getting or generating instance:', error);
    throw error;
  }
}

/**
 * Regenerate instance (recalculate students from courses)
 * Used when courses are modified or for manual data fixes
 */
export async function regenerateInstance(businessId, instanceId) {
  try {
    return await regenerateInstanceStudents(businessId, instanceId);
  } catch (error) {
    console.error('Error regenerating instance:', error);
    throw error;
  }
}

/**
 * Batch generate instances for a template for a date range
 * Useful for pre-generating instances for a week/month
 */
export async function batchGenerateInstances(businessId, templateId, startDate, endDate, dayOfWeek) {
  try {
    const instances = [];
    const current = new Date(startDate);
    current.setHours(0, 0, 0, 0);
    
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);
    
    // Generate instances for each matching day
    while (current <= end) {
      if (current.getDay() === dayOfWeek) {
        const instance = await getOrGenerateInstance(businessId, templateId, current);
        instances.push(instance);
      }
      current.setDate(current.getDate() + 1);
    }
    
    return instances;
  } catch (error) {
    console.error('Error batch generating instances:', error);
    throw error;
  }
}

/**
 * Check if instance needs regeneration (if courses were modified after instance creation)
 */
export async function instanceNeedsRegeneration(businessId, instanceId) {
  try {
    const instance = await getClassInstanceById(businessId, instanceId);
    
    // Standalone instances don't need regeneration
    if (!instance.templateId) {
      return false;
    }
    
    // If instance was manually modified, don't regenerate
    if (instance.isModified) {
      return false;
    }
    
    // Get instance creation time
    const instanceCreatedAt = instance.createdAt?.toDate ? instance.createdAt.toDate() : new Date(instance.createdAt);
    
    // Get all courses containing this template
    const { getCoursesWithTemplate } = await import('./course-service.js');
    const courses = await getCoursesWithTemplate(businessId, instance.templateId);
    
    // Check if any course was updated after instance creation
    for (const course of courses) {
      const courseUpdatedAt = course.updatedAt?.toDate ? course.updatedAt.toDate() : new Date(course.updatedAt);
      if (courseUpdatedAt > instanceCreatedAt) {
        return true;
      }
    }
    
    // Check enrollments
    const { getAllEnrollments } = await import('./enrollment-service.js');
    const enrollments = await getAllEnrollments(businessId);
    
    for (const enrollment of enrollments) {
      // Check if enrollment affects this course
      const enrollmentUpdatedAt = enrollment.updatedAt?.toDate ? enrollment.updatedAt.toDate() : new Date(enrollment.updatedAt);
      if (enrollmentUpdatedAt > instanceCreatedAt) {
        // Check if this enrollment is for a course containing the template
        const course = courses.find(c => c.id === enrollment.courseId);
        if (course) {
          return true;
        }
      }
    }
    
    return false;
  } catch (error) {
    console.error('Error checking if instance needs regeneration:', error);
    return false;
  }
}

/**
 * Auto-regenerate instance if needed
 * Returns the instance (regenerated if necessary)
 */
export async function autoRegenerateIfNeeded(businessId, instanceId) {
  try {
    const needsRegen = await instanceNeedsRegeneration(businessId, instanceId);
    
    if (needsRegen) {
      console.log(`Instance ${instanceId} needs regeneration, regenerating...`);
      await regenerateInstance(businessId, instanceId);
    }
    
    return await getClassInstanceById(businessId, instanceId);
  } catch (error) {
    console.error('Error auto-regenerating instance:', error);
    throw error;
  }
}
