const {onSchedule} = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
const moment = require('moment-timezone');

/**
 * Scheduled function to generate class instances
 * Runs weekly to create instances for the next month
 */
exports.generateClassInstances = onSchedule(
  {
    schedule: '0 0 * * 0', // Run every Sunday at midnight
    timeZone: 'Asia/Jerusalem',
    memory: '256MiB',
    timeoutSeconds: 540
  },
  async (event) => {
    try {
      console.log('Starting class instance generation...');
      
      const db = admin.firestore();
      
      // Get all active businesses
      const businessesSnapshot = await db.collection('businesses')
        .where('isActive', '==', true)
        .get();
      
      for (const businessDoc of businessesSnapshot.docs) {
        const businessId = businessDoc.id;
        
        // Get all active class templates for this business
        const templatesSnapshot = await db
          .collection(`businesses/${businessId}/classTemplates`)
          .where('isActive', '==', true)
          .get();
        
        for (const templateDoc of templatesSnapshot.docs) {
          const template = templateDoc.data();
          const templateId = templateDoc.id;
          
          // Generate instances for next 3 months
          await generateInstancesForTemplate(db, businessId, templateId, template);
        }
      }
      
      console.log('Class instance generation completed');
      return null;
    } catch (error) {
      console.error('Error generating class instances:', error);
      throw error;
    }
  }
);

/**
 * Generate instances for a class template
 */
async function generateInstancesForTemplate(db, businessId, templateId, template) {
  const startDate = moment().tz('Asia/Jerusalem').startOf('day');
  const endDate = moment().tz('Asia/Jerusalem').add(1, 'month').endOf('day');
  
  const instances = [];
  const currentDate = startDate.clone();
  
  // Generate instances based on recurrence rule
  while (currentDate.isBefore(endDate)) {
    // Check if this day matches the template's day of week
    if (currentDate.day() === template.dayOfWeek) {
      // Check if instance already exists
      const existingInstances = await db
        .collection(`businesses/${businessId}/classInstances`)
        .where('templateId', '==', templateId)
        .where('date', '==', admin.firestore.Timestamp.fromDate(currentDate.toDate()))
        .get();
      
      if (existingInstances.empty) {
        // Create new instance
        const instance = {
          templateId,
          name: template.name,
          date: admin.firestore.Timestamp.fromDate(currentDate.toDate()),
          startTime: template.startTime,
          endTime: template.endTime,
          teacherId: template.teacherId,
          styleId: template.styleId,
          room: template.room || '',
          status: 'scheduled',
          studentIds: template.defaultStudentIds || [],
          notes: '',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          generatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        
        instances.push(instance);
      }
    }
    
    // Move to next day
    currentDate.add(1, 'day');
  }
  
  // Batch write instances
  if (instances.length > 0) {
    const batch = db.batch();
    instances.forEach(instance => {
      const ref = db.collection(`businesses/${businessId}/classInstances`).doc();
      batch.set(ref, instance);
    });
    
    await batch.commit();
    console.log(`Generated ${instances.length} instances for template ${templateId}`);
  }
}
