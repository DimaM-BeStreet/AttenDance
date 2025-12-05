/**
 * Populate Database with Fake Data
 * Run this script to add sample students, teachers, classes, and attendance
 * 
 * Usage: node populate-db.js
 * 
 * Note: Make sure you have Firebase Admin SDK credentials set up
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Initialize Firebase Admin
// Download service account key from: https://console.firebase.google.com/project/attendance-6e07e/settings/serviceaccounts/adminsdk
let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
  console.log('✅ Using service account key from serviceAccountKey.json\n');
} catch (error) {
  console.error('❌ Error: serviceAccountKey.json not found!');
  console.error('\n📋 To fix this:');
  console.error('1. Go to: https://console.firebase.google.com/project/attendance-6e07e/settings/serviceaccounts/adminsdk');
  console.error('2. Click "Generate new private key"');
  console.error('3. Save the file as "serviceAccountKey.json" in this directory');
  console.error('4. Run this script again\n');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'attendance-6e07e'
});

const db = admin.firestore();
const auth = admin.auth();
const Timestamp = admin.firestore.Timestamp;

// Your business ID - UPDATE THIS with your actual business ID
const BUSINESS_ID = 'demo-business-001';
const BUSINESS_ID_2 = 'demo-business-002';

// Sample data helpers
const FIRST_NAMES = ['נועה', 'תמר', 'מאיה', 'אביגיל', 'טליה', 'שרה', 'יעל', 'אדל', 'שירה', 'רומי', 'אסתר', 'ליאן', 'אלה', 'הילה', 'עמית', 'אורי', 'דוד', 'אריאל', 'יוסף', 'איתן', 'דניאל', 'יהונתן', 'משה', 'עידו', 'עומר', 'איתי'];
const LAST_NAMES = ['כהן', 'לוי', 'מזרחי', 'פרץ', 'ביטון', 'דהן', 'אברהם', 'פרידמן', 'מלכה', 'אזולאי', 'כץ', 'יוסף', 'חדד', 'עמר', 'אוחיון', 'גבאי', 'שפירא', 'ברק', 'רוזנברג', 'סגל'];
const CITIES = ['תל אביב', 'רמת גן', 'גבעתיים', 'חולון', 'בת ים', 'ראשון לציון', 'פתח תקווה', 'הרצליה'];
const STREETS = ['הרצל', 'דיזנגוף', 'בן יהודה', 'ארלוזורוב', 'ז\'בוטינסקי', 'רוטשילד', 'אלנבי', 'קינג ג\'ורג\'', 'ויצמן', 'ביאליק'];

function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateRandomPhone() {
  return '05' + Math.floor(Math.random() * 10) + '-' + Math.floor(1000000 + Math.random() * 9000000);
}

function generateRandomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

// Generate 100 students
const STUDENTS = [];
for (let i = 0; i < 100; i++) {
  const firstName = getRandomItem(FIRST_NAMES);
  const lastName = getRandomItem(LAST_NAMES);
  const parentFirstName = getRandomItem(FIRST_NAMES); // Simplified
  
  STUDENTS.push({
    firstName: firstName,
    lastName: lastName,
    email: `student${i + 1}@example.com`,
    phone: generateRandomPhone(),
    birthDate: generateRandomDate(new Date('2008-01-01'), new Date('2015-12-31')),
    address: `רחוב ${getRandomItem(STREETS)} ${Math.floor(Math.random() * 100)}, ${getRandomItem(CITIES)}`,
    photoUrl: `https://i.pravatar.cc/150?img=${(i % 70) + 1}`,
    parentName: `${parentFirstName} ${lastName}`,
    parentPhone: generateRandomPhone(),
    parentEmail: `parent${i + 1}@example.com`,
    isActive: Math.random() > 0.1, // 90% active
    isComplete: false,
    registrationDate: Timestamp.now(),
    notes: Math.random() > 0.7 ? 'הערה אקראית על התלמיד' : ''
  });
}

// Generate 10 Teachers
const TEACHERS = [];
const SPECIALIZATIONS = ['בלט קלאסי', 'היפ הופ', 'ג\'אז', 'מודרני', 'ברייקדאנס', 'מחול יצירתי', 'אקרובטיקה'];

for (let i = 0; i < 10; i++) {
  const firstName = getRandomItem(FIRST_NAMES);
  const lastName = getRandomItem(LAST_NAMES);
  
  TEACHERS.push({
    firstName: firstName,
    lastName: lastName,
    email: `teacher${i + 1}@example.com`,
    phone: generateRandomPhone(),
    specialization: getRandomItem(SPECIALIZATIONS),
    bio: 'מורה מנוסה ומקצועית עם אהבה גדולה למחול והוראה.',
    isActive: true,
    uniqueLink: 'teacher-' + i + '-' + Math.random().toString(36).substring(7)
  });
}

const BRANCHES = [
  {
    name: 'תל אביב',
    shortName: 'ת"א',
    city: 'תל אביב',
    address: 'רחוב דיזנגוף 100',
    phone: '03-1234567',
    managerEmail: 'manager.tlv@attendance.com',
    branchEmail: 'tlv@attendance.com',
    isActive: true
  },
  {
    name: 'רמת גן',
    shortName: 'ר"ג',
    city: 'רמת גן',
    address: 'רחוב ביאליק 50',
    phone: '03-7654321',
    managerEmail: 'manager.rg@attendance.com',
    branchEmail: 'rg@attendance.com',
    isActive: true
  },
  {
    name: 'ירושלים',
    shortName: 'י-ם',
    city: 'ירושלים',
    address: 'רחוב יפו 200',
    phone: '02-1234567',
    managerEmail: 'manager.jlm@attendance.com',
    branchEmail: 'jlm@attendance.com',
    isActive: true
  }
];

const LOCATIONS = [
  {
    name: 'אולם A',
    maxStudents: 20,
    description: 'אולם ראשי עם ריצוף מקצועי ומראות',
    isActive: true,
    branchIndex: 0 // תל אביב
  },
  {
    name: 'אולם B',
    maxStudents: 25,
    description: 'אולם גדול לשיעורים מתקדמים',
    isActive: true,
    branchIndex: 0 // תל אביב
  },
  {
    name: 'אולם ראשי',
    maxStudents: 20,
    description: 'אולם מרכזי עם ציוד מלא',
    isActive: true,
    branchIndex: 1 // רמת גן
  },
  {
    name: 'חדר תרגול',
    maxStudents: 10,
    description: 'חדר קטן לאימונים פרטניים',
    isActive: true,
    branchIndex: 1 // רמת גן
  },
  {
    name: 'סטודיו 1',
    maxStudents: 30,
    description: 'סטודיו מרווח בירושלים',
    isActive: true,
    branchIndex: 2 // ירושלים
  },
  {
    name: 'סטודיו 2',
    maxStudents: 15,
    description: 'סטודיו אינטימי',
    isActive: true,
    branchIndex: 2 // ירושלים
  }
];

// Will be generated in addClassTemplates
const CLASS_TEMPLATES = []; 

/**
 * Helper to generate keywords for search
 */
function generateKeywords(text) {
  if (!text) return [];
  const words = text.toLowerCase().split(/\s+/);
  const keywords = new Set();
  
  words.forEach(word => {
    // Add full word
    keywords.add(word);
    
    // Add prefixes (min 2 chars)
    for (let i = 2; i <= word.length; i++) {
      keywords.add(word.substring(0, i));
    }
  });
  
  return Array.from(keywords);
}

/**
 * Create admin user
 */
async function createAdminUser() {
  try {
    console.log('Creating admin users...');
    
    // 1. Super Admin (admin@attendance.com)
    try {
      const userRecord = await auth.createUser({
        email: 'admin@attendance.com',
        password: 'Admin123!',
        displayName: 'מנהל ראשי'
      });
      await db.collection('users').doc(userRecord.uid).set({
        email: 'admin@attendance.com',
        displayName: 'מנהל ראשי',
        role: 'superAdmin', // Explicitly superAdmin
        businessId: BUSINESS_ID,
        allowedBusinessIds: [BUSINESS_ID, BUSINESS_ID_2],
        createdAt: Timestamp.now()
      });
      console.log('✅ Super Admin created: admin@attendance.com');
    } catch (e) {
      if (e.code === 'auth/email-already-exists') {
        const user = await auth.getUserByEmail('admin@attendance.com');
        await db.collection('users').doc(user.uid).set({
          email: 'admin@attendance.com',
          displayName: 'מנהל ראשי',
          role: 'superAdmin',
          businessId: BUSINESS_ID,
          allowedBusinessIds: [BUSINESS_ID, BUSINESS_ID_2],
          updatedAt: Timestamp.now()
        }, { merge: true });
        console.log('✅ Super Admin updated');
      }
    }

    // 2. Admin for Business 2 (admin2@attendance.com)
    try {
      const userRecord2 = await auth.createUser({
        email: 'admin2@attendance.com',
        password: 'Admin123!',
        displayName: 'מנהל עסק 2'
      });
      await db.collection('users').doc(userRecord2.uid).set({
        email: 'admin2@attendance.com',
        displayName: 'מנהל עסק 2',
        role: 'admin',
        businessId: BUSINESS_ID_2,
        allowedBusinessIds: [BUSINESS_ID_2],
        createdAt: Timestamp.now()
      });
      console.log('✅ Admin 2 created: admin2@attendance.com');
    } catch (e) {
      if (e.code === 'auth/email-already-exists') {
        const user = await auth.getUserByEmail('admin2@attendance.com');
        await db.collection('users').doc(user.uid).set({
          email: 'admin2@attendance.com',
          displayName: 'מנהל עסק 2',
          role: 'admin',
          businessId: BUSINESS_ID_2,
          allowedBusinessIds: [BUSINESS_ID_2],
          updatedAt: Timestamp.now()
        }, { merge: true });
        console.log('✅ Admin 2 updated');
      }
    }

    // 3. Multi-Business Manager (manager_multi@attendance.com)
    try {
      const userRecordMulti = await auth.createUser({
        email: 'manager_multi@attendance.com',
        password: 'Admin123!',
        displayName: 'מנהל רב-עסקי'
      });
      await db.collection('users').doc(userRecordMulti.uid).set({
        email: 'manager_multi@attendance.com',
        displayName: 'מנהל רב-עסקי',
        role: 'admin',
        businessId: BUSINESS_ID, // Default business
        allowedBusinessIds: [BUSINESS_ID, BUSINESS_ID_2], // Access to both
        createdAt: Timestamp.now()
      });
      console.log('✅ Multi-Manager created: manager_multi@attendance.com');
    } catch (e) {
      if (e.code === 'auth/email-already-exists') {
        const user = await auth.getUserByEmail('manager_multi@attendance.com');
        await db.collection('users').doc(user.uid).set({
          email: 'manager_multi@attendance.com',
          displayName: 'מנהל רב-עסקי',
          role: 'admin',
          businessId: BUSINESS_ID,
          allowedBusinessIds: [BUSINESS_ID, BUSINESS_ID_2],
          updatedAt: Timestamp.now()
        }, { merge: true });
        console.log('✅ Multi-Manager updated');
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error creating users:', error);
    throw error;
  }
}

/**
 * Clear existing data from business
 */
async function clearBusinessData(businessId) {
  try {
    console.log(`\nClearing existing data for ${businessId}...`);
    
    const collections = ['students', 'teachers', 'branches', 'locations', 'classTemplates', 'courses', 'enrollments', 'classInstances', 'attendance'];
    
    for (const collectionName of collections) {
      const snapshot = await db
        .collection('businesses')
        .doc(businessId)
        .collection(collectionName)
        .get();
      
      if (!snapshot.empty) {
        const batch = db.batch();
        snapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        console.log(`  ✅ Cleared ${snapshot.size} documents from ${collectionName}`);
      }
    }
    
    // Clear temp students from root collection
    const tempStudentsSnapshot = await db
      .collection('tempStudents')
      .where('businessId', '==', businessId)
      .get();
    
    if (!tempStudentsSnapshot.empty) {
      const batch = db.batch();
      tempStudentsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      console.log(`  ✅ Cleared ${tempStudentsSnapshot.size} temp students`);
    }
    
    console.log('✅ All data cleared');
  } catch (error) {
    console.error('Error clearing data:', error);
    throw error;
  }
}

/**
 * Create business document
 */
async function createBusiness(id, name, email) {
  try {
    console.log(`\nCreating business ${name}...`);
    
    await db.collection('businesses').doc(id).set({
      name: name,
      contactName: 'מנהל מערכת',
      address: 'כתובת הדגמה',
      phone: '050-0000000',
      email: email,
      settings: {
        timezone: 'Asia/Jerusalem',
        currency: 'ILS',
        language: 'he'
      },
      createdAt: Timestamp.now()
    });
    
    console.log('✅ Business created');
  } catch (error) {
    console.error('Error creating business:', error);
    throw error;
  }
}

/**
 * Add students
 */
async function addStudents(businessId) {
  try {
    console.log(`\nAdding students to ${businessId}...`);
    
    const studentIds = [];
    // Add 20 students per business for demo
    const demoStudents = STUDENTS.slice(0, 20); 
    
    for (const student of demoStudents) {
      const docRef = await db
        .collection('businesses')
        .doc(businessId)
        .collection('students')
        .add(student);
      studentIds.push(docRef.id);
    }
    
    console.log(`✅ Added ${studentIds.length} students`);
    return studentIds;
  } catch (error) {
    console.error('Error adding students:', error);
    throw error;
  }
}

/**
 * Add teachers
 */
async function addTeachers(businessId) {
  try {
    console.log(`\nAdding teachers to ${businessId}...`);
    
    const teacherIds = [];
    // Add 5 teachers per business
    const demoTeachers = TEACHERS.slice(0, 5);
    
    for (const teacher of demoTeachers) {
      const docRef = await db
        .collection('businesses')
        .doc(businessId)
        .collection('teachers')
        .add(teacher);
      teacherIds.push(docRef.id);
    }
    
    console.log(`✅ Added ${teacherIds.length} teachers`);
    return teacherIds;
  } catch (error) {
    console.error('Error adding teachers:', error);
    throw error;
  }
}

/**
 * Add branches
 */
async function addBranches(businessId) {
  try {
    console.log(`\nAdding branches to ${businessId}...`);
    
    const branchIds = [];
    
    for (const branch of BRANCHES) {
      const docRef = await db
        .collection('businesses')
        .doc(businessId)
        .collection('branches')
        .add({
          ...branch,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
      branchIds.push(docRef.id);
    }
    
    console.log(`✅ Added ${branchIds.length} branches`);
    return branchIds;
  } catch (error) {
    console.error('Error adding branches:', error);
    throw error;
  }
}

/**
 * Add locations
 */
async function addLocations(businessId, branchIds) {
  try {
    console.log(`\nAdding locations to ${businessId}...`);
    
    const locationIds = [];
    
    for (const location of LOCATIONS) {
      const { branchIndex, ...locationData } = location;
      const branchId = branchIds[branchIndex] || null;
      const shortName = BRANCHES[branchIndex]?.shortName || '';
      const docRef = await db
        .collection('businesses')
        .doc(businessId)
        .collection('locations')
        .add({
          ...locationData,
          branchId,
          shortName,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
      locationIds.push(docRef.id);
    }
    
    console.log(`✅ Added ${locationIds.length} locations`);
    return locationIds;
  } catch (error) {
    console.error('Error adding locations:', error);
    throw error;
  }
}

/**
 * Add class templates (no students - templates are just structure)
 */
async function addClassTemplates(businessId, teacherIds, locationIds, branchIds) {
  try {
    console.log(`\nAdding class templates to ${businessId}...`);
    
    const templateIds = [];
    const STYLES = ['בלט', 'היפ הופ', 'ג\'אז', 'מודרני', 'אקרובטיקה', 'מחול יצירתי', 'ברייקדאנס'];
    const LEVELS = ['מתחילים', 'בינוני', 'מתקדמים', 'להקה', 'עתודה'];
    
    // Generate 10 templates per business
    for (let i = 0; i < 10; i++) {
      // Assign teacher (cycle through available teachers to ensure at least one per teacher)
      const teacherIndex = i % teacherIds.length;
      const teacherId = teacherIds[teacherIndex];
      // Assign location (cycle through locations to ensure distribution across branches)
      const locationIdx = i % locationIds.length;
      const locationId = locationIds[locationIdx];
      // Get branch from location
      const locationBranchIndex = LOCATIONS[locationIdx].branchIndex;
      const branchId = branchIds[locationBranchIndex] || null;
      const style = getRandomItem(STYLES);
      const level = getRandomItem(LEVELS);
      const name = `${style} ${level}`;
      const template = {
        name: name,
        description: `שיעור ${style} לרמת ${level}`,
        duration: [45, 60, 75, 90][Math.floor(Math.random() * 4)],
        dayOfWeek: Math.floor(Math.random() * 6), // 0-5 (Sun-Fri)
        startTime: `${14 + Math.floor(Math.random() * 6)}:${Math.random() > 0.5 ? '00' : '30'}`,
        isActive: true
      };
      // Calculate end time
      const [hours, minutes] = template.startTime.split(':').map(Number);
      const totalMinutes = hours * 60 + minutes + template.duration;
      const endHours = Math.floor(totalMinutes / 60);
      const endMinutes = totalMinutes % 60;
      template.endTime = `${endHours}:${endMinutes.toString().padStart(2, '0')}`;
      const docRef = await db
        .collection('businesses')
        .doc(businessId)
        .collection('classTemplates')
        .add({
          ...template,
          teacherId,
          locationId,
          branchId,
          createdAt: Timestamp.now()
        }
      );
      templateIds.push({ id: docRef.id, ...template, teacherId, locationId, branchId });
      
      // Auto course creation logic...
      const autoCourseName = `רק ${template.name} (*אוטומטי)`;
      const schedule = [{
        dayOfWeek: template.dayOfWeek,
        startTime: template.startTime,
        duration: template.duration,
        templateId: docRef.id,
        teacherId: teacherId,
        templateName: template.name,
        branchId: branchId
      }];

      await db
        .collection('businesses')
        .doc(businessId)
        .collection('courses')
        .add({
          name: autoCourseName,
          description: `קורס אוטומטי עבור תבנית ${template.name}`,
          templateIds: [docRef.id],
          schedule: schedule,
          startDate: Timestamp.now(),
          endDate: Timestamp.fromDate(new Date(Date.now() + 1000 * 60 * 60 * 24 * 180)),
          price: 0,
          maxStudents: 20,
          isActive: true,
          keywords: generateKeywords(autoCourseName),
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          autoCreated: true
        });
    }
    
    console.log(`✅ Added ${templateIds.length} class templates`);
    return templateIds;
  } catch (error) {
    console.error('Error adding class templates:', error);
    throw error;
  }
}

/**
 * Add courses with templates and students
 */
async function addCourses(businessId, templates, studentIds) {
  try {
    console.log(`\nAdding courses to ${businessId}...`);
    
    const courseIds = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Generate 5 courses per business
    for (let i = 0; i < 5; i++) {
      const numTemplates = Math.floor(Math.random() * 2) + 1;
      const selectedTemplates = [];
      for (let j = 0; j < numTemplates; j++) {
        selectedTemplates.push(getRandomItem(templates));
      }
      const uniqueTemplates = [...new Set(selectedTemplates)];
      
      const numStudents = Math.floor(Math.random() * 5) + 5;
      const selectedStudents = [];
      const shuffledStudents = [...studentIds].sort(() => 0.5 - Math.random());
      const courseStudents = shuffledStudents.slice(0, numStudents);
      
      const name = `קורס ${uniqueTemplates[0].name.split(' - ')[0]} ${i + 1}`;
      
      const schedule = uniqueTemplates.map(t => ({
        dayOfWeek: t.dayOfWeek,
        startTime: t.startTime,
        duration: t.duration,
        templateId: t.id,
        teacherId: t.teacherId,
        templateName: t.name,
        branchId: t.branchId
      }));

      const docRef = await db
        .collection('businesses')
        .doc(businessId)
        .collection('courses')
        .add({
          name: name,
          description: `קורס הכולל ${uniqueTemplates.length} שיעורים שבועיים`,
          templateIds: uniqueTemplates.map(t => t.id),
          schedule: schedule,
          startDate: Timestamp.fromDate(new Date(today.getFullYear(), today.getMonth(), 1)),
          endDate: Timestamp.fromDate(new Date(today.getFullYear(), today.getMonth() + 5, 1)),
          price: 200 + Math.floor(Math.random() * 500),
          maxStudents: 20,
          isActive: true,
          keywords: generateKeywords(name),
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
        
      courseIds.push({ id: docRef.id, templateIds: uniqueTemplates.map(t => t.id), studentIds: courseStudents });
    }
    
    console.log(`✅ Added ${courseIds.length} courses`);
    return courseIds;
  } catch (error) {
    console.error('Error adding courses:', error);
    throw error;
  }
}

/**
 * Add enrollments linking students to courses
 */
async function addEnrollments(businessId, courses) {
  try {
    console.log(`\nAdding enrollments to ${businessId}...`);
    
    let enrollmentCount = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (const course of courses) {
      for (const studentId of course.studentIds) {
        await db
          .collection('businesses')
          .doc(businessId)
          .collection('enrollments')
          .add({
            courseId: course.id,
            studentId,
            effectiveFrom: Timestamp.fromDate(new Date(today.getFullYear(), today.getMonth(), 1)),
            effectiveTo: null,
            isActive: true,
            paymentStatus: 'paid',
            amountPaid: 0,
            totalAmount: 0,
            enrollmentDate: Timestamp.now(),
            notes: '',
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
          });
        enrollmentCount++;
      }
    }
    
    console.log(`✅ Added ${enrollmentCount} enrollments`);
  } catch (error) {
    console.error('Error adding enrollments:', error);
    throw error;
  }
}

/**
 * Create class instances for the next 7 days (aggregate students from courses)
 */
async function createClassInstances(businessId, templates, courses) {
  try {
    console.log(`\nCreating class instances for ${businessId}...`);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const instanceIds = [];
    
    // Create instances for next 14 days
    for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
      const date = new Date(today);
      date.setDate(date.getDate() + dayOffset);
      const dayOfWeek = date.getDay();
      
      const dayTemplates = templates.filter(t => t.dayOfWeek === dayOfWeek);
      
      for (const template of dayTemplates) {
        const coursesWithTemplate = courses.filter(c => c.templateIds.includes(template.id));
        const allStudentIds = [...new Set(coursesWithTemplate.flatMap(c => c.studentIds))];
        
        const docRef = await db
          .collection('businesses')
          .doc(businessId)
          .collection('classInstances')
          .add({
            templateId: template.id,
            name: template.name,
            date: Timestamp.fromDate(date),
            startTime: template.startTime,
            duration: template.duration || 60,
            teacherId: template.teacherId,
            locationId: template.locationId,
            status: 'scheduled',
            studentIds: allStudentIds,
            isModified: false,
            notes: '',
            keywords: generateKeywords(template.name),
            createdAt: Timestamp.now()
          }
        );
        
        instanceIds.push({ id: docRef.id, date, studentIds: allStudentIds });
      }
    }
    
    console.log(`✅ Created ${instanceIds.length} class instances`);
    return instanceIds;
  } catch (error) {
    console.error('Error creating class instances:', error);
    throw error;
  }
}

/**
 * Add sample attendance for past classes
 */
async function addSampleAttendance(businessId, instances) {
  try {
    console.log(`\nAdding sample attendance for ${businessId}...`);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let attendanceCount = 0;
    
    for (const instance of instances) {
      const classDate = instance.date;
      
      if (classDate < today) {
        for (const studentId of instance.studentIds) {
          const rand = Math.random();
          let status;
          if (rand < 0.75) status = 'present';
          else if (rand < 0.85) status = 'late';
          else if (rand < 0.95) status = 'absent';
          else status = 'excused';
          
          await db
            .collection('businesses')
            .doc(businessId)
            .collection('attendance')
            .add({
              classInstanceId: instance.id,
              studentId,
              status,
              markedAt: Timestamp.now(),
              markedBy: 'system',
              notes: status === 'late' ? 'איחר 10 דקות' : ''
            }
          );
          
          attendanceCount++;
        }
      }
    }
    
    console.log(`✅ Added ${attendanceCount} attendance records`);
  } catch (error) {
    console.error('Error adding attendance:', error);
    throw error;
  }
}

/**
 * Calculate and sync stats for all students
 */
async function calculateAndSyncStats(businessId) {
  try {
    const studentsRef = db.collection(`businesses/${businessId}/students`);
    const studentsSnapshot = await studentsRef.get();
    
    if (studentsSnapshot.empty) {
      console.log('   No students found to sync.');
      return;
    }

    const students = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    let updateCount = 0;
    const batchSize = 500; // Firestore batch limit
    let batch = db.batch();
    let operationCount = 0;

    console.log(`   Processing ${students.length} students...`);

    for (const student of students) {
      const studentId = student.id;

      // 1. Get class instances
      const instancesSnapshot = await db.collection(`businesses/${businessId}/classInstances`)
        .where('studentIds', 'array-contains', studentId)
        .get();
      
      const instances = instancesSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      instances.sort((a, b) => a.date.toMillis() - b.date.toMillis());

      // 2. Get attendance
      const attendanceSnapshot = await db.collection(`businesses/${businessId}/attendance`)
        .where('studentId', '==', studentId)
        .get();
      
      const attendance = attendanceSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      attendance.sort((a, b) => a.date.toMillis() - b.date.toMillis());

      // 3. Get active enrollments
      const enrollmentsSnapshot = await db.collection(`businesses/${businessId}/enrollments`)
        .where('studentId', '==', studentId)
        .where('isActive', '==', true)
        .get();

      // 4. Calculate Stats
      const stats = {
        totalClasses: instances.length,
        activeEnrollments: enrollmentsSnapshot.size,
        lastUpdated: Timestamp.now()
      };

      // First Class Info
      if (instances.length > 0) {
        const firstClass = instances[0];
        stats.firstClassId = firstClass.id;
        stats.firstClassDate = firstClass.date;
        stats.firstClassBranchId = firstClass.branchId || null;
        stats.firstClassTeacherId = firstClass.teacherId || null;
        
        // Check if attended first class
        const attendedFirst = attendance.some(a => a.classInstanceId === firstClass.id);
        stats.firstClassAttended = attendedFirst;
      } else {
        stats.firstClassId = null;
        stats.firstClassDate = null;
        stats.firstClassBranchId = null;
        stats.firstClassTeacherId = null;
        stats.firstClassAttended = false;
      }

      // First Attendance Info
      if (attendance.length > 0) {
        const firstAtt = attendance[0];
        stats.firstAttendanceId = firstAtt.id;
        stats.firstAttendanceDate = firstAtt.date;
        stats.firstAttendanceClassId = firstAtt.classInstanceId;
        
        // Find branch info from instance
        // We might have it in 'instances' if the student is still in that class
        let attClass = instances.find(i => i.id === firstAtt.classInstanceId);
        
        if (!attClass) {
          // Fetch if not found (rare in this script context but good for robustness)
          const classDoc = await db.collection(`businesses/${businessId}/classInstances`).doc(firstAtt.classInstanceId).get();
          if (classDoc.exists) {
            attClass = classDoc.data();
          }
        }

        if (attClass) {
          stats.firstAttendanceBranchId = attClass.branchId || null;
          stats.firstAttendanceTeacherId = attClass.teacherId || null;
        } else {
          stats.firstAttendanceBranchId = null;
          stats.firstAttendanceTeacherId = null;
        }
      } else {
        stats.firstAttendanceId = null;
        stats.firstAttendanceDate = null;
        stats.firstAttendanceBranchId = null;
        stats.firstAttendanceTeacherId = null;
      }

      // Add to batch
      const studentRef = db.collection(`businesses/${businessId}/students`).doc(studentId);
      batch.update(studentRef, { stats });
      operationCount++;
      updateCount++;

      // Commit batch if full
      if (operationCount >= batchSize) {
        await batch.commit();
        batch = db.batch();
        operationCount = 0;
        process.stdout.write('.');
      }
    }

    // Commit remaining
    if (operationCount > 0) {
      await batch.commit();
    }

    console.log(`\n   ✅ Synced stats for ${updateCount} students.`);

  } catch (error) {
    console.error('   ❌ Error syncing stats:', error);
  }
}

/**
 * Ensure all templates have a corresponding auto-created course
 */
async function ensureAutoCoursesForTemplates(businessId) {
  try {
    console.log('\n🔄 Verifying auto-created courses for templates...');
    
    // Get all templates
    const templatesSnapshot = await db.collection(`businesses/${businessId}/classTemplates`).get();
    const templates = templatesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Get all courses
    const coursesSnapshot = await db.collection(`businesses/${businessId}/courses`).get();
    const courses = coursesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    let createdCount = 0;
    
    for (const template of templates) {
      // Check if there is an auto-created course for this template
      const hasAutoCourse = courses.some(c => 
        c.autoCreated === true && 
        Array.isArray(c.templateIds) && 
        c.templateIds.length === 1 && 
        c.templateIds[0] === template.id
      );
      
      if (!hasAutoCourse) {
        console.log(`   ⚠️ Missing auto-course for template: ${template.name} (${template.id}). Creating...`);
        
        const autoCourseName = `רק ${template.name} (*אוטומטי)`;
        
        // Create schedule array
        const schedule = [{
          dayOfWeek: template.dayOfWeek,
          startTime: template.startTime,
          duration: template.duration,
          templateId: template.id,
          teacherId: template.teacherId,
          templateName: template.name,
          branchId: template.branchId
        }];

        await db
          .collection('businesses')
          .doc(businessId)
          .collection('courses')
          .add({
            name: autoCourseName,
            description: `קורס אוטומטי עבור תבנית ${template.name}`,
            templateIds: [template.id],
            schedule: schedule,
            startDate: Timestamp.now(),
            endDate: Timestamp.fromDate(new Date(Date.now() + 1000 * 60 * 60 * 24 * 180)), // 6 months from now
            price: 0,
            maxStudents: 20,
            isActive: true,
            keywords: generateKeywords(autoCourseName),
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
            autoCreated: true
          });
          
        createdCount++;
      }
    }
    
    if (createdCount > 0) {
      console.log(`   ✅ Created ${createdCount} missing auto-courses.`);
    } else {
      console.log('   ✅ All templates have corresponding auto-courses.');
    }
    
  } catch (error) {
    console.error('   ❌ Error ensuring auto-courses:', error);
  }
}

/**
 * Populate a single business
 */
async function populateBusiness(businessId, name, email) {
  console.log(`\n--- Populating Business: ${name} (${businessId}) ---`);
  
  await createBusiness(businessId, name, email);
  await clearBusinessData(businessId);
  
  const studentIds = await addStudents(businessId);
  const teacherIds = await addTeachers(businessId);
  const branchIds = await addBranches(businessId);
  const locationIds = await addLocations(businessId, branchIds);
  const templates = await addClassTemplates(businessId, teacherIds, locationIds, branchIds);
  const courses = await addCourses(businessId, templates, studentIds);
  await addEnrollments(businessId, courses);
  const instances = await createClassInstances(businessId, templates, courses);
  await addSampleAttendance(businessId, instances);
  
  console.log('\n🔄 Calculating student statistics...');
  await calculateAndSyncStats(businessId);
  await ensureAutoCoursesForTemplates(businessId);
}

/**
 * Main function
 */
async function populateDatabase() {
  console.log('🚀 Starting database population...\n');
  
  try {
    // Create users first
    await createAdminUser();
    
    // Populate Business 1
    await populateBusiness(BUSINESS_ID, 'סטודיו אורבני פלייסי', 'Avivi.Avidani@gmail.com');
    
    // Populate Business 2
    await populateBusiness(BUSINESS_ID_2, 'סטודיו דאנס מאסטר', 'admin2@attendance.com');
    
    console.log('\n✅ Database population complete!');
    console.log('\n🔐 Login credentials:');
    console.log('   1. Super Admin: admin@attendance.com / Admin123!');
    console.log('   2. Business 2 Admin: admin2@attendance.com / Admin123!');
    console.log('   3. Multi-Business Manager: manager_multi@attendance.com / Admin123!');
    console.log('\n🌐 Live URL: https://attendance-6e07e.web.app');
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

// Run the script
populateDatabase().then(() => {
  console.log('\n✨ All done! You can now login and use the system.');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
