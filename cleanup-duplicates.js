/**
 * Utility to clean up duplicate students
 * Run this in browser console on students page
 */

// Copy this entire function and paste in browser console:

async function cleanupDuplicateStudents() {
  const { collection, getDocs, deleteDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
  const { db } = window; // Assumes db is available globally
  
  // Get current Business ID from page
  const businessId = sessionStorage.getItem('currentBusinessId') || prompt('Enter Business ID:');
  
  if (!businessId) {
    console.error('Business ID required');
    return;
  }
  
  console.log('Fetching students...');
  const studentsRef = collection(db, `businesses/${businessId}/students`);
  const snapshot = await getDocs(studentsRef);
  
  const students = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  
  console.log(`Total students: ${students.length}`);
  
  // Group by phone number
  const phoneGroups = {};
  students.forEach(student => {
    if (!student.phone) return;
    
    const normalizedPhone = student.phone.replace(/\D/g, '');
    if (!phoneGroups[normalizedPhone]) {
      phoneGroups[normalizedPhone] = [];
    }
    phoneGroups[normalizedPhone].push(student);
  });
  
  // Find duplicates
  const duplicateGroups = Object.entries(phoneGroups).filter(([phone, students]) => students.length > 1);
  
  console.log(`Found ${duplicateGroups.length} phone numbers with duplicates`);
  
  let totalDuplicates = 0;
  const toDelete = [];
  
  duplicateGroups.forEach(([phone, students]) => {
    // Sort by createdAt, keep the oldest (or most complete)
    students.sort((a, b) => {
      // If one has importedAt and other doesn't, keep the one without (original)
      if (a.importedAt && !b.importedAt) return 1;
      if (!a.importedAt && b.importedAt) return -1;
      
      // Otherwise keep the oldest
      const aTime = a.createdAt?.toMillis?.() || 0;
      const bTime = b.createdAt?.toMillis?.() || 0;
      return aTime - bTime;
    });
    
    console.log(`Phone ${phone}: ${students.length} duplicates`);
    console.log(`  Keeping: ${students[0].firstName} ${students[0].lastName} (${students[0].id})`);
    
    // Mark all except first for deletion
    for (let i = 1; i < students.length; i++) {
      console.log(`  Deleting: ${students[i].firstName} ${students[i].lastName} (${students[i].id})`);
      toDelete.push(students[i].id);
      totalDuplicates++;
    }
  });
  
  console.log(`\nTotal duplicates to delete: ${totalDuplicates}`);
  
  const confirm = window.confirm(`Found ${totalDuplicates} duplicate students. Delete them?\n\nThis will keep the oldest student for each phone number.`);
  
  if (!confirm) {
    console.log('Cancelled');
    return;
  }
  
  console.log('Deleting duplicates...');
  let deleted = 0;
  
  for (const studentId of toDelete) {
    try {
      await deleteDoc(doc(db, `businesses/${businessId}/students`, studentId));
      deleted++;
      if (deleted % 10 === 0) {
        console.log(`Deleted ${deleted}/${totalDuplicates}...`);
      }
    } catch (error) {
      console.error(`Failed to delete ${studentId}:`, error);
    }
  }
  
  console.log(`✅ Done! Deleted ${deleted} duplicate students.`);
  console.log('Please refresh the page.');
}

// Run the cleanup
cleanupDuplicateStudents();
