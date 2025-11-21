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

// Your studio ID - UPDATE THIS with your actual studio ID
const STUDIO_ID = 'demo-studio-001';

// Sample data
const STUDENTS = [
  {
    firstName: 'שרה',
    lastName: 'כהן',
    email: 'sara.cohen@example.com',
    phone: '052-1234567',
    birthDate: new Date('2010-03-15'),
    address: 'רחוב הרצל 10, תל אביב',
    photoUrl: 'https://i.pravatar.cc/150?img=1',
    parentContact: {
      name: 'דוד כהן',
      phone: '052-7654321',
      email: 'david.cohen@example.com'
    },
    active: true,
    registrationDate: Timestamp.now(),
    notes: 'תלמידה מצטיינת, אוהבת ריקודים מודרניים'
  },
  {
    firstName: 'יעל',
    lastName: 'לוי',
    email: 'yael.levi@example.com',
    phone: '054-2345678',
    birthDate: new Date('2011-07-22'),
    address: 'רחוב בן יהודה 25, תל אביב',
    photoUrl: 'https://i.pravatar.cc/150?img=5',
    parentContact: {
      name: 'רונית לוי',
      phone: '054-8765432',
      email: 'ronit.levi@example.com'
    },
    active: true,
    registrationDate: Timestamp.now(),
    notes: 'מתחילה, צריכה עידוד'
  },
  {
    firstName: 'נועה',
    lastName: 'מזרחי',
    email: 'noa.mizrahi@example.com',
    phone: '053-3456789',
    birthDate: new Date('2009-11-08'),
    address: 'רחוב דיזנגוף 50, תל אביב',
    photoUrl: 'https://i.pravatar.cc/150?img=9',
    parentContact: {
      name: 'משה מזרחי',
      phone: '053-9876543',
      email: 'moshe.mizrahi@example.com'
    },
    active: true,
    registrationDate: Timestamp.now(),
    notes: 'רקדנית מוכשרת מאוד'
  },
  {
    firstName: 'תמר',
    lastName: 'אברהם',
    email: 'tamar.avraham@example.com',
    phone: '050-4567890',
    birthDate: new Date('2012-01-30'),
    address: 'רחוב אלנבי 15, תל אביב',
    photoUrl: 'https://i.pravatar.cc/150?img=10',
    parentContact: {
      name: 'יוסי אברהם',
      phone: '050-0987654',
      email: 'yossi.avraham@example.com'
    },
    active: true,
    registrationDate: Timestamp.now(),
    notes: 'חדשה בסטודיו'
  },
  {
    firstName: 'מיכל',
    lastName: 'דוד',
    email: 'michal.david@example.com',
    phone: '052-5678901',
    birthDate: new Date('2010-05-12'),
    address: 'רחוב ויצמן 8, רמת גן',
    photoUrl: 'https://i.pravatar.cc/150?img=16',
    parentContact: {
      name: 'שרון דוד',
      phone: '052-1098765',
      email: 'sharon.david@example.com'
    },
    active: true,
    registrationDate: Timestamp.now(),
    notes: 'אוהבת היפ הופ'
  },
  {
    firstName: 'רונית',
    lastName: 'ישראלי',
    email: 'ronit.israeli@example.com',
    phone: '054-6789012',
    birthDate: new Date('2011-09-25'),
    address: 'רחוב רוטשילד 42, תל אביב',
    photoUrl: 'https://i.pravatar.cc/150?img=20',
    parentContact: {
      name: 'אבי ישראלי',
      phone: '054-2109876',
      email: 'avi.israeli@example.com'
    },
    active: true,
    registrationDate: Timestamp.now(),
    notes: 'מתקדמת, מתעניינת בבלט'
  },
  {
    firstName: 'ליאור',
    lastName: 'שמעון',
    email: 'lior.shimon@example.com',
    phone: '053-7890123',
    birthDate: new Date('2013-02-14'),
    address: 'רחוב ביאלק 30, רמת גן',
    photoUrl: 'https://i.pravatar.cc/150?img=25',
    parentContact: {
      name: 'דנה שמעון',
      phone: '053-3210987',
      email: 'dana.shimon@example.com'
    },
    active: false,
    registrationDate: Timestamp.now(),
    notes: 'הפסיקה זמנית'
  },
  {
    firstName: 'עדן',
    lastName: 'חיים',
    email: 'eden.haim@example.com',
    phone: '050-8901234',
    birthDate: new Date('2010-12-05'),
    address: 'רחוב שינקין 18, תל אביב',
    photoUrl: 'https://i.pravatar.cc/150?img=30',
    parentContact: {
      name: 'ערן חיים',
      phone: '050-4321098',
      email: 'eran.haim@example.com'
    },
    active: true,
    registrationDate: Timestamp.now(),
    notes: 'מוכנה לתחרויות'
  }
];

const TEACHERS = [
  {
    firstName: 'מיכל',
    lastName: 'רוזנברג',
    email: 'michal.teacher@example.com',
    phone: '052-1111111',
    specialization: 'בלט קלאסי',
    bio: 'רקדנית ומורה מנוסה עם 15 שנות ניסיון. בוגרת האקדמיה למוסיקה ולמחול בירושלים.',
    active: true,
    uniqueLink: 'teacher-michal-' + Math.random().toString(36).substring(7)
  },
  {
    firstName: 'דנה',
    lastName: 'שפירא',
    email: 'dana.teacher@example.com',
    phone: '054-2222222',
    specialization: 'היפ הופ ורחוב',
    bio: 'מורה צעירה ואנרגטית, מתמחה בסגנונות עכשוויים. השתתפה בתחרויות בינלאומיות.',
    active: true,
    uniqueLink: 'teacher-dana-' + Math.random().toString(36).substring(7)
  },
  {
    firstName: 'רון',
    lastName: 'ברק',
    email: 'ron.teacher@example.com',
    phone: '053-3333333',
    specialization: 'ג\'אז ומודרני',
    bio: 'רקדן ומורה עם רקע במחול עכשווי. עבד עם להקות מחול מובילות.',
    active: true,
    uniqueLink: 'teacher-ron-' + Math.random().toString(36).substring(7)
  }
];

const LOCATIONS = [
  {
    name: 'אולם A',
    maxStudents: 20,
    description: 'אולם ראשי עם ריצוף מקצועי ומראות',
    isActive: true
  },
  {
    name: 'אולם B',
    maxStudents: 25,
    description: 'אולם גדול לשיעורים מתקדמים',
    isActive: true
  },
  {
    name: 'חדר תרגול',
    maxStudents: 10,
    description: 'חדר קטן לאימונים פרטניים',
    isActive: true
  }
];

const CLASS_TEMPLATES = [
  {
    name: 'בלט מתחילים',
    description: 'שיעור בלט לילדים מתחילים',
    duration: 60,
    dayOfWeek: 0, // Sunday
    startTime: '16:00',
    endTime: '17:00',
    // locationId will be set dynamically (references LOCATIONS[0] - אולם A)
    active: true,
    color: '#FF6B6B'
  },
  {
    name: 'היפ הופ מתקדמים',
    description: 'שיעור היפ הופ לרמה מתקדמת',
    duration: 75,
    dayOfWeek: 1, // Monday
    startTime: '17:30',
    endTime: '18:45',
    // locationId will be set dynamically (references LOCATIONS[1] - אולם B)
    active: true,
    color: '#4ECDC4'
  },
  {
    name: 'ג\'אז ביניים',
    description: 'שיעור ג\'אז לרמת ביניים',
    duration: 60,
    dayOfWeek: 2, // Tuesday
    startTime: '16:30',
    endTime: '17:30',
    // locationId will be set dynamically (references LOCATIONS[0] - אולם A)
    active: true,
    color: '#95E1D3'
  },
  {
    name: 'מודרני מתחילים',
    description: 'מחול עכשווי למתחילים',
    duration: 60,
    dayOfWeek: 3, // Wednesday
    startTime: '17:00',
    endTime: '18:00',
    // locationId will be set dynamically (references LOCATIONS[1] - אולם B)
    active: true,
    color: '#F38181'
  },
  {
    name: 'בלט מתקדמים',
    description: 'בלט קלאסי לרמה מתקדמת',
    duration: 90,
    dayOfWeek: 4, // Thursday
    startTime: '16:00',
    endTime: '17:30',
    // locationId will be set dynamically (references LOCATIONS[0] - אולם A)
    active: true,
    color: '#AA96DA'
  }
];

/**
 * Create admin user
 */
async function createAdminUser() {
  try {
    console.log('Creating admin user...');
    
    // Create auth user with Admin SDK
    const userRecord = await auth.createUser({
      email: 'admin@attendance.com',
      password: 'Admin123!',
      displayName: 'מנהל ראשי'
    });
    
    const userId = userRecord.uid;
    
    // Create user document
    await db.collection('users').doc(userId).set({
      email: 'admin@attendance.com',
      displayName: 'מנהל ראשי',
      role: 'admin',
      businessId: STUDIO_ID,
      createdAt: Timestamp.now()
    });
    
    console.log('✅ Admin user created: admin@attendance.com / Admin123!');
    console.log(`   User ID: ${userId}`);
    
    return userId;
  } catch (error) {
    if (error.code === 'auth/email-already-exists' || error.errorInfo?.code === 'auth/email-already-exists') {
      console.log('ℹ️  Admin user already exists, getting existing user...');
      const user = await auth.getUserByEmail('admin@attendance.com');
      
      // Update user document to ensure businessId is correct
      await db.collection('users').doc(user.uid).set({
        email: 'admin@attendance.com',
        displayName: 'מנהל ראשי',
        role: 'admin',
        businessId: STUDIO_ID,
        updatedAt: Timestamp.now()
      }, { merge: true });
      
      console.log(`✅ Updated user document with businessId: ${STUDIO_ID}`);
      console.log(`   User ID: ${user.uid}`);
      return user.uid;
    }
    throw error;
  }
}

/**
 * Clear existing data from studio
 */
async function clearStudioData() {
  try {
    console.log('\nClearing existing data...');
    
    const collections = ['students', 'teachers', 'locations', 'classTemplates', 'courses', 'enrollments', 'classInstances', 'attendance'];
    
    for (const collectionName of collections) {
      const snapshot = await db
        .collection('studios')
        .doc(STUDIO_ID)
        .collection(collectionName)
        .get();
      
      if (!snapshot.empty) {
        const batch = db.batch();
        snapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        console.log(`  ✅ Cleared ${snapshot.size} documents from ${collectionName}`);
      } else {
        console.log(`  ℹ️  No documents to clear from ${collectionName}`);
      }
    }
    
    console.log('✅ All data cleared');
  } catch (error) {
    console.error('Error clearing data:', error);
    throw error;
  }
}

/**
 * Create studio document
 */
async function createStudio() {
  try {
    console.log('\nCreating studio...');
    
    await db.collection('studios').doc(STUDIO_ID).set({
      name: 'סטודיו ריקוד אטנדנס',
      address: 'רחוב הרצל 123, תל אביב',
      phone: '03-1234567',
      email: 'info@attendance-studio.com',
      settings: {
        timezone: 'Asia/Jerusalem',
        currency: 'ILS',
        language: 'he'
      },
      createdAt: Timestamp.now()
    });
    
    console.log('✅ Studio created');
  } catch (error) {
    console.error('Error creating studio:', error);
    throw error;
  }
}

/**
 * Add students
 */
async function addStudents() {
  try {
    console.log('\nAdding students...');
    
    const studentIds = [];
    
    for (const student of STUDENTS) {
      const docRef = await db
        .collection('studios')
        .doc(STUDIO_ID)
        .collection('students')
        .add(student);
      studentIds.push(docRef.id);
      console.log(`  ✅ Added: ${student.firstName} ${student.lastName}`);
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
async function addTeachers() {
  try {
    console.log('\nAdding teachers...');
    
    const teacherIds = [];
    
    for (const teacher of TEACHERS) {
      const docRef = await db
        .collection('studios')
        .doc(STUDIO_ID)
        .collection('teachers')
        .add(teacher);
      teacherIds.push(docRef.id);
      console.log(`  ✅ Added: ${teacher.firstName} ${teacher.lastName}`);
      console.log(`     Link: /teacher/attendance.html?teacher=${docRef.id}`);
    }
    
    console.log(`✅ Added ${teacherIds.length} teachers`);
    return teacherIds;
  } catch (error) {
    console.error('Error adding teachers:', error);
    throw error;
  }
}

/**
 * Add locations
 */
async function addLocations() {
  try {
    console.log('\nAdding locations...');
    
    const locationIds = [];
    
    for (const location of LOCATIONS) {
      const docRef = await db
        .collection('studios')
        .doc(STUDIO_ID)
        .collection('locations')
        .add({
          ...location,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
      locationIds.push(docRef.id);
      console.log(`  ✅ Added: ${location.name} (capacity: ${location.maxStudents})`);
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
async function addClassTemplates(teacherIds, locationIds) {
  try {
    console.log('\nAdding class templates...');
    
    const templateIds = [];
    
    // Location assignment pattern: A, B, A, B, A
    const locationPattern = [0, 1, 0, 1, 0];
    
    for (let i = 0; i < CLASS_TEMPLATES.length; i++) {
      const template = CLASS_TEMPLATES[i];
      
      // Assign teacher (cycle through available teachers)
      const teacherId = teacherIds[i % teacherIds.length];
      
      // Assign location based on pattern
      const locationId = locationIds[locationPattern[i]];
      
      const docRef = await db
        .collection('studios')
        .doc(STUDIO_ID)
        .collection('classTemplates')
        .add({
          ...template,
          teacherId,
          locationId, // Reference to location (not string)
          // No defaultStudentIds - templates don't hold students anymore
          createdAt: Timestamp.now()
        }
      );
      
      templateIds.push({ id: docRef.id, ...template, teacherId, locationId });
      console.log(`  ✅ Added: ${template.name}`);
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
async function addCourses(templates, studentIds) {
  try {
    console.log('\nAdding courses...');
    
    const courseIds = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Course 1: Hip Hop Course (contains 2 templates)
    const hipHopTemplates = templates.filter(t => t.name.includes('היפ הופ'));
    if (hipHopTemplates.length > 0) {
      const course1Students = studentIds.slice(0, 8); // First 8 students
      const docRef1 = await db
        .collection('studios')
        .doc(STUDIO_ID)
        .collection('courses')
        .add({
          name: 'קורס היפ הופ - מתחילים עד מתקדמים',
          description: 'קורס מקיף של היפ הופ לכל הרמות',
          templateIds: hipHopTemplates.map(t => t.id),
          startDate: Timestamp.fromDate(new Date(today.getFullYear(), today.getMonth(), 1)), // Started this month
          endDate: Timestamp.fromDate(new Date(today.getFullYear(), today.getMonth() + 5, 1)), // Ends in 5 months
          price: 800,
          maxStudents: 15,
          status: 'active',
          isActive: true,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
      courseIds.push({ id: docRef1.id, templateIds: hipHopTemplates.map(t => t.id), studentIds: course1Students });
      console.log(`  ✅ Added: קורס היפ הופ (${course1Students.length} תלמידים, ${hipHopTemplates.length} שיעורים)`);
    }
    
    // Course 2: Ballet & Modern Mix (contains 2 templates)
    const balletTemplates = templates.filter(t => t.name.includes('בלט'));
    const modernTemplates = templates.filter(t => t.name.includes('מודרני'));
    if (balletTemplates.length > 0 && modernTemplates.length > 0) {
      const course2Students = studentIds.slice(5, 13); // Students 5-12 (some overlap with course 1)
      const docRef2 = await db
        .collection('studios')
        .doc(STUDIO_ID)
        .collection('courses')
        .add({
          name: 'קורס בלט ומודרני משולב',
          description: 'שילוב של בלט קלאסי ומחול מודרני',
          templateIds: [...balletTemplates.map(t => t.id), ...modernTemplates.map(t => t.id)],
          startDate: Timestamp.fromDate(new Date(today.getFullYear(), today.getMonth(), 1)), // Started this month
          endDate: Timestamp.fromDate(new Date(today.getFullYear(), today.getMonth() + 6, 1)), // Ends in 6 months
          price: 900,
          maxStudents: 12,
          status: 'active',
          isActive: true,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
      courseIds.push({ id: docRef2.id, templateIds: [...balletTemplates.map(t => t.id), ...modernTemplates.map(t => t.id)], studentIds: course2Students });
      console.log(`  ✅ Added: קורס בלט ומודרני (${course2Students.length} תלמידים, ${balletTemplates.length + modernTemplates.length} שיעורים)`);
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
async function addEnrollments(courses) {
  try {
    console.log('\nAdding enrollments...');
    
    let enrollmentCount = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (const course of courses) {
      for (const studentId of course.studentIds) {
        await db
          .collection('studios')
          .doc(STUDIO_ID)
          .collection('enrollments')
          .add({
            courseId: course.id,
            studentId,
            effectiveFrom: Timestamp.fromDate(new Date(today.getFullYear(), today.getMonth(), 1)), // Started this month
            effectiveTo: null, // Active, no end date
            status: 'active',
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
async function createClassInstances(templates, courses) {
  try {
    console.log('\nCreating class instances...');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const instanceIds = [];
    
    // Create instances for next 30 days
    for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
      const date = new Date(today);
      date.setDate(date.getDate() + dayOffset);
      const dayOfWeek = date.getDay();
      
      // Find templates for this day
      const dayTemplates = templates.filter(t => t.dayOfWeek === dayOfWeek);
      
      for (const template of dayTemplates) {
        // Find all courses containing this template
        const coursesWithTemplate = courses.filter(c => c.templateIds.includes(template.id));
        
        // Aggregate students from all courses
        const allStudentIds = [...new Set(coursesWithTemplate.flatMap(c => c.studentIds))];
        
        const docRef = await db
          .collection('studios')
          .doc(STUDIO_ID)
          .collection('classInstances')
          .add({
            templateId: template.id,
            name: template.name,
            date: Timestamp.fromDate(date),
            startTime: template.startTime,
            duration: template.duration || 60,
            teacherId: template.teacherId,
            locationId: template.locationId, // Reference to location
            status: 'scheduled',
            studentIds: allStudentIds, // Aggregated from all courses
            isModified: false,
            notes: '',
            createdAt: Timestamp.now()
          }
        );
        
        instanceIds.push({ id: docRef.id, date, studentIds: allStudentIds });
        console.log(`  ✅ ${date.toLocaleDateString('he-IL')}: ${template.name} (${allStudentIds.length} תלמידים מ-${coursesWithTemplate.length} קורסים)`);
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
async function addSampleAttendance(instances) {
  try {
    console.log('\nAdding sample attendance...');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let attendanceCount = 0;
    
    // Add attendance for classes that happened in the past
    for (const instance of instances) {
      const classDate = instance.date;
      
      // Only add attendance for past classes
      if (classDate < today) {
        for (const studentId of instance.studentIds) {
          // Random attendance status (mostly present)
          const rand = Math.random();
          let status;
          if (rand < 0.75) status = 'present';
          else if (rand < 0.85) status = 'late';
          else if (rand < 0.95) status = 'absent';
          else status = 'excused';
          
          await db
            .collection('studios')
            .doc(STUDIO_ID)
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
 * Main function
 */
async function populateDatabase() {
  console.log('🚀 Starting database population...\n');
  console.log(`Studio ID: ${STUDIO_ID}\n`);
  
  try {
    // Create admin user
    await createAdminUser();
    
    // Create studio
    await createStudio();
    
    // Clear existing data
    await clearStudioData();
    
    // Add students
    const studentIds = await addStudents();
    
    // Add teachers
    const teacherIds = await addTeachers();
    
    // Add locations
    const locationIds = await addLocations();
    
    // Add class templates (no students - just structure)
    const templates = await addClassTemplates(teacherIds, locationIds);
    
    // Add courses (collections of templates with enrolled students)
    const courses = await addCourses(templates, studentIds);
    
    // Add enrollments (student-course relationships)
    await addEnrollments(courses);
    
    // Create class instances (aggregate students from courses)
    const instances = await createClassInstances(templates, courses);
    
    // Add sample attendance
    await addSampleAttendance(instances);
    
    console.log('\n✅ Database population complete!');
    console.log('\n📋 Summary:');
    console.log(`   - 1 studio`);
    console.log(`   - 1 admin user`);
    console.log(`   - ${studentIds.length} students`);
    console.log(`   - ${teacherIds.length} teachers`);
    console.log(`   - ${locationIds.length} locations`);
    console.log(`   - ${templates.length} class templates`);
    console.log(`   - ${courses.length} courses`);
    console.log(`   - ${instances.length} class instances`);
    console.log('\n🔐 Login credentials:');
    console.log('   Email: admin@attendance.com');
    console.log('   Password: Admin123!');
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
