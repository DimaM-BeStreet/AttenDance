# AttenDance - Dance Studio Management System
## Project Overview v2.0 (Updated Architecture)

---

## Core Concepts & Data Flow

### 1. Class Templates (Basic Building Blocks)
**What they are:**
- Define the structure of a recurring class (teacher, day, time, location, duration)
- Do NOT contain student lists
- Reusable across multiple courses
- Examples: "Hip Hop Monday 17:00", "Ballet Wednesday 18:00"

**Fields:**
- `name`, `teacherId`, `dayOfWeek`, `startTime`, `duration`, `location`, `danceStyleId`
- `maxStudents`, `description`, `isActive`
- **NO `defaultStudentIds` field**

### 2. Courses (Student Enrollment Containers)
**What they are:**
- Collections of one or more class templates
- Define which students are enrolled
- Can have pricing, start/end dates
- Students enroll in COURSES, not templates

**Structure:**
```javascript
{
  name: "Hip Hop + Jazz Package",
  description: "Twice a week intensive program",
  templateIds: ["hip-hop-template-id", "jazz-template-id"],  // Multiple templates
  studentIds: ["student1", "student2", ...],                 // Enrolled students
  price: 500,
  startDate: Timestamp,          // Optional - can be null for ongoing
  endDate: Timestamp,            // Optional - can be null for ongoing (infinity)
  teacherId: "primary-teacher",  // Optional - main instructor
  danceStyleId: "style-id",      // Optional - for categorization
  isActive: true,
  status: "active"               // active, upcoming, completed, cancelled
}
```

**Examples:**
- **Course A**: "Hip Hop + Jazz Package" (30 students, 2 templates)
- **Course B**: "Hip Hop + Ballet Package" (10 students, 2 templates, one shared with Course A)
- **Course C**: "Single Ballet Class" (15 students, 1 template) - for simple single-class enrollments

### 3. Class Instances (Actual Classes with Dates)
**What they are:**
- Specific occurrences of a class on a specific date
- Generated from templates on-demand (when viewing calendar dates)
- Student list is AGGREGATED from all courses that include the template

**Student Aggregation Logic:**
```javascript
// When creating instance from template "Hip Hop Monday"
instance.studentIds = [
  ...getAllStudentsFromCourse(courseA),  // 30 students
  ...getAllStudentsFromCourse(courseB),  // 10 students
] // = 40 total students

// Only include students whose course dates are active on instance date
```

**Fields:**
- `name`, `templateId`, `teacherId`, `date`, `startTime`, `duration`, `location`
- `studentIds`: Array - aggregated from all active courses
- `status`: "scheduled", "completed", "cancelled"
- `notes`, `isModified`

### 4. Enrollment Management (enrollments collection)
**What it tracks:**
- Which student is in which course
- Enrollment date, payment status, notes

**Structure:**
```javascript
{
  studentId: "student-id",
  courseId: "course-id",
  enrollmentDate: Timestamp,
  status: "active" | "paused" | "cancelled",
  paymentStatus: "paid" | "pending" | "partial",
  effectiveFrom: Timestamp,     // When enrollment starts affecting instances
  effectiveTo: Timestamp,        // Optional - when to stop adding to instances
  notes: ""
}
```

---

## Key User Workflows

### Workflow 1: Setting Up Classes
1. **Create Class Templates** (defining recurring classes)
   - Teacher assigns: "Hip Hop Monday 17:00 with Dana"
   - Template stored without students
   
2. **Create Courses** (grouping templates)
   - Course: "Hip Hop + Jazz Intensive"
   - Select templates: [Hip Hop Monday, Jazz Wednesday]
   - Set price: ₪500/month
   - Set dates: Optional start/end

3. **Enroll Students** (adding students to courses)
   - Student "Sarah" enrolls in "Hip Hop + Jazz Intensive"
   - Sarah now appears in both Hip Hop and Jazz instances

### Workflow 2: Managing Enrollments
**Adding a student to a course:**
1. Select course
2. Add student
3. System prompts: "Add from which date?" (default: today)
4. System automatically adds student to all FUTURE instances of all templates in that course

**Removing a student from a course:**
1. Select course
2. Remove student
3. System prompts: "Remove from which date?" (default: today)
4. System removes student from all FUTURE instances
5. Past instances remain unchanged (for attendance history)

**Pausing enrollment:**
- Set `status: "paused"` with pause dates
- Student removed from instances during pause period
- Automatically resumes after pause end date

### Workflow 3: Viewing Calendar
1. Manager views calendar for a week
2. System generates instances on-demand:
   - For each day, find templates with matching `dayOfWeek`
   - For each template, aggregate students from all active courses
   - Create/retrieve instance with full student list
3. Display classes with correct student counts

### Workflow 4: Marking Attendance
1. Teacher opens class instance
2. Sees aggregated student list (from all courses)
3. Marks attendance for each student
4. System stores attendance record

---

## Database Structure

### Collections Hierarchy
```
studios/{studioId}/
  ├── students/              # Student profiles
  ├── teachers/              # Teacher profiles
  ├── danceStyles/           # Dance style categories
  ├── classTemplates/        # Recurring class definitions (NO student lists)
  ├── courses/               # Course packages with template + student lists
  ├── enrollments/           # Student-course relationships
  ├── classInstances/        # Actual classes on specific dates
  └── attendance/            # Attendance records
```

### Key Relationships
```
Course ──includes──> Multiple Class Templates
Course ──enrolls──> Multiple Students
Class Template ──generates──> Multiple Class Instances
Class Instance ──aggregates students from──> Multiple Courses
```

---

## Technical Implementation Notes

### Instance Generation Algorithm
```javascript
async function generateInstance(templateId, date) {
  const template = await getTemplate(templateId);
  
  // Find all courses that include this template
  const courses = await getCoursesWithTemplate(templateId);
  
  // Aggregate students from all active courses on this date
  let studentIds = [];
  for (const course of courses) {
    if (isCourseActiveOnDate(course, date)) {
      const enrollments = await getActiveCourseEnrollments(course.id, date);
      studentIds.push(...enrollments.map(e => e.studentId));
    }
  }
  
  // Remove duplicates (if student enrolled in multiple courses)
  studentIds = [...new Set(studentIds)];
  
  return createInstance({
    templateId,
    date,
    studentIds,
    ...templateData
  });
}
```

### Course Enrollment Sync
```javascript
async function addStudentToCourse(courseId, studentId, effectiveFrom) {
  // 1. Create enrollment record
  await createEnrollment(courseId, studentId, effectiveFrom);
  
  // 2. Get all templates in the course
  const course = await getCourse(courseId);
  
  // 3. Add student to all future instances
  for (const templateId of course.templateIds) {
    const futureInstances = await getFutureInstances(templateId, effectiveFrom);
    for (const instance of futureInstances) {
      await addStudentToInstance(instance.id, studentId);
    }
  }
}

async function removeStudentFromCourse(courseId, studentId, effectiveFrom) {
  // 1. Update enrollment status
  await updateEnrollment(courseId, studentId, { 
    status: 'cancelled',
    effectiveTo: effectiveFrom 
  });
  
  // 2. Get all templates in the course
  const course = await getCourse(courseId);
  
  // 3. Remove student from future instances only
  for (const templateId of course.templateIds) {
    const futureInstances = await getFutureInstances(templateId, effectiveFrom);
    for (const instance of futureInstances) {
      await removeStudentFromInstance(instance.id, studentId);
    }
  }
  
  // Past instances remain untouched for attendance history
}
```

---

## User Roles & Permissions

### Super Admin
- Full system access
- Manage multiple studios
- Configure system settings

### Studio Manager
- Manage their studio's data
- Create/edit templates, courses, students, teachers
- View reports and analytics
- Manage enrollments

### Teacher
- View assigned classes
- Mark attendance
- View student lists for their classes
- Read-only access to student profiles

---

## Technology Stack

### Frontend
- Vanilla JavaScript (ES6+)
- Firebase Authentication
- Firebase Firestore SDK
- Webpack for bundling
- CSS3 with RTL support

### Backend
- Firebase Firestore (NoSQL database)
- Firebase Storage (file uploads)
- Firebase Hosting
- Firebase Cloud Functions (future)

### Development
- Node.js for build tools
- ESLint for code quality
- Firebase Emulators for local testing

---

## Migration from V1 to V2

### Breaking Changes
1. **Templates no longer store student lists**
   - Remove `defaultStudentIds` field from all templates
   - Data will be lost - acceptable for pre-production

2. **Courses become mandatory for enrollment**
   - All student enrollments must go through courses
   - Single-class enrollment = course with one template

3. **Instance generation changes**
   - Must aggregate students from multiple courses
   - Cannot copy from template anymore

### Migration Steps
1. Clear all existing data (pre-production)
2. Update all service functions
3. Create new UI for course management
4. Update populate-db.js with new structure
5. Test enrollment sync mechanisms
6. Deploy to production

---

## Future Enhancements

1. **Automated Instance Generation**
   - Background job to pre-generate instances for next 3 months
   - Trigger on course creation/update

2. **Waitlist Management**
   - When course/class is full
   - Automatic enrollment when spot opens

3. **Payment Integration**
   - Stripe/PayPal integration
   - Automatic payment tracking

4. **Attendance Analytics**
   - Student attendance patterns
   - Teacher performance metrics

5. **Mobile App**
   - React Native or Flutter
   - Push notifications for classes

---

## Contact & Support

**Project:** AttenDance Dance Studio Management System  
**Version:** 2.0 (Architecture Redesign)  
**Last Updated:** November 19, 2025
