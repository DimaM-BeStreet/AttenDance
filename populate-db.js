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

const CLASS_TEMPLATES = [
  {
    name: 'בלט מתחילים',
    description: 'שיעור בלט לילדים מתחילים',
    duration: 60,
    dayOfWeek: 0, // Sunday
    startTime: '16:00',
    endTime: '17:00',
    maxStudents: 15,
    location: 'אולם A',
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
    maxStudents: 20,
    location: 'אולם B',
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
    maxStudents: 18,
    location: 'אולם A',
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
    maxStudents: 15,
    location: 'אולם B',
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
    maxStudents: 12,
    location: 'אולם A',
    active: true,
    color: '#AA96DA'
  }
];

/**
 * Create manager user
 */
async function createManagerUser() {
  try {
    console.log('Creating manager user...');
    
    // Create auth user with Admin SDK
    const userRecord = await auth.createUser({
      email: 'manager@attendance.com',
      password: 'Manager123!',
      displayName: 'מנהל ראשי'
    });
    
    const userId = userRecord.uid;
    
    // Create user document
    await db.collection('users').doc(userId).set({
      email: 'manager@attendance.com',
      displayName: 'מנהל ראשי',
      role: 'manager',
      businessId: STUDIO_ID,
      createdAt: Timestamp.now()
    });
    
    console.log('✅ Manager user created: manager@attendance.com / Manager123!');
    console.log(`   User ID: ${userId}`);
    
    return userId;
  } catch (error) {
    if (error.code === 'auth/email-already-in-use') {
      console.log('ℹ️  Manager user already exists');
      return null;
    }
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
 * Add class templates
 */
async function addClassTemplates(teacherIds) {
  try {
    console.log('\nAdding class templates...');
    
    const templateIds = [];
    
    for (let i = 0; i < CLASS_TEMPLATES.length; i++) {
      const template = CLASS_TEMPLATES[i];
      
      // Assign teacher (cycle through available teachers)
      const teacherId = teacherIds[i % teacherIds.length];
      
      const docRef = await db
        .collection('studios')
        .doc(STUDIO_ID)
        .collection('classTemplates')
        .add({
          ...template,
          teacherId,
          createdAt: Timestamp.now()
        }
      );
      
      templateIds.push({ id: docRef.id, ...template, teacherId });
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
 * Create class instances for the next 7 days
 */
async function createClassInstances(templates, studentIds) {
  try {
    console.log('\nCreating class instances...');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const instanceIds = [];
    
    // Create instances for next 7 days
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const date = new Date(today);
      date.setDate(date.getDate() + dayOffset);
      const dayOfWeek = date.getDay();
      
      // Find templates for this day
      const dayTemplates = templates.filter(t => t.dayOfWeek === dayOfWeek);
      
      for (const template of dayTemplates) {
        // Enroll 5-8 random students
        const numStudents = Math.floor(Math.random() * 4) + 5; // 5-8
        const enrolledStudents = studentIds
          .sort(() => 0.5 - Math.random())
          .slice(0, Math.min(numStudents, studentIds.length));
        
        const docRef = await db
          .collection('studios')
          .doc(STUDIO_ID)
          .collection('classInstances')
          .add({
            templateId: template.id,
            templateName: template.name,
            date: Timestamp.fromDate(date),
            startTime: template.startTime,
            endTime: template.endTime,
            teacherId: template.teacherId,
            location: template.location,
            maxStudents: template.maxStudents,
            status: 'scheduled',
            enrolledStudents,
            createdAt: Timestamp.now()
          }
        );
        
        instanceIds.push({ id: docRef.id, date, enrolledStudents });
        console.log(`  ✅ ${date.toLocaleDateString('he-IL')}: ${template.name} (${enrolledStudents.length} תלמידים)`);
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
        for (const studentId of instance.enrolledStudents) {
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
    // Create manager user
    await createManagerUser();
    
    // Create studio
    await createStudio();
    
    // Add students
    const studentIds = await addStudents();
    
    // Add teachers
    const teacherIds = await addTeachers();
    
    // Add class templates
    const templates = await addClassTemplates(teacherIds);
    
    // Create class instances
    const instances = await createClassInstances(templates, studentIds);
    
    // Add sample attendance
    await addSampleAttendance(instances);
    
    console.log('\n✅ Database population complete!');
    console.log('\n📋 Summary:');
    console.log(`   - 1 studio`);
    console.log(`   - 1 manager user`);
    console.log(`   - ${studentIds.length} students`);
    console.log(`   - ${teacherIds.length} teachers`);
    console.log(`   - ${templates.length} class templates`);
    console.log(`   - ${instances.length} class instances`);
    console.log('\n🔐 Login credentials:');
    console.log('   Email: manager@attendance.com');
    console.log('   Password: Manager123!');
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
