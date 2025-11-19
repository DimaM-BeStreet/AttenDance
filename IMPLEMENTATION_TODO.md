# Implementation TODO: Course-Based Architecture Migration

## Phase 1: Data Model & Service Layer Updates

### 1.1 Update Class Template Service ✅ CRITICAL
**File:** `src/services/class-template-service.js`
- [ ] **Remove student enrollment functions:**
  - Delete `getTemplateEnrolledStudents()`
  - Delete `addStudentToTemplate()`
  - Delete `removeStudentFromTemplate()`
- [ ] **Update `createClassTemplate()` to remove `defaultStudentIds: []` initialization**
- [ ] **Update template structure documentation in comments**

### 1.2 Update Course Service ✅ CRITICAL
**File:** `src/services/course-service.js`
- [ ] **Update course structure to include `templateIds` array:**
  ```javascript
  {
    name: string,
    description: string,
    templateIds: string[],     // Array of template IDs
    price: number,
    startDate: Timestamp | null,
    endDate: Timestamp | null,
    teacherId: string | null,
    danceStyleId: string | null,
    isActive: boolean,
    status: string
  }
  ```
- [ ] **Create `addTemplatesToCourse(courseId, templateIds)`**
- [ ] **Create `removeTemplatesFromCourse(courseId, templateIds)`**
- [ ] **Create `getCoursesWithTemplate(templateId)` - find all courses using a template**
- [ ] **Create `isCourseActiveOnDate(course, date)` - check if course is active on specific date**
- [ ] **Update `getCourseEnrollments()` to use enrollments collection properly**

### 1.3 Update/Create Enrollment Service ✅ CRITICAL
**File:** `src/services/enrollment-service.js`
- [ ] **Update enrollment structure:**
  ```javascript
  {
    studentId: string,
    courseId: string,
    enrollmentDate: Timestamp,
    effectiveFrom: Timestamp,
    effectiveTo: Timestamp | null,
    status: "active" | "paused" | "cancelled",
    paymentStatus: "paid" | "pending" | "partial",
    notes: string
  }
  ```
- [ ] **Create `enrollStudentInCourse(courseId, studentId, effectiveFrom, options)`**
- [ ] **Create `removeStudentFromCourse(courseId, studentId, effectiveTo, options)`**
- [ ] **Create `pauseEnrollment(enrollmentId, pauseFrom, pauseTo)`**
- [ ] **Create `getActiveCourseEnrollments(courseId, forDate)` - get active enrollments for a date**
- [ ] **Create `getStudentEnrollments(studentId)` - get all courses a student is in**

### 1.4 Update Class Instance Service ✅ CRITICAL
**File:** `src/services/class-instance-service.js`
- [ ] **Create `generateInstanceFromTemplate(templateId, date)` - aggregate students from courses:**
  ```javascript
  async function generateInstanceFromTemplate(businessId, templateId, date) {
    const template = await getClassTemplateById(businessId, templateId);
    const courses = await getCoursesWithTemplate(businessId, templateId);
    
    let studentIds = [];
    for (const course of courses) {
      if (isCourseActiveOnDate(course, date)) {
        const enrollments = await getActiveCourseEnrollments(businessId, course.id, date);
        studentIds.push(...enrollments.map(e => e.studentId));
      }
    }
    
    // Remove duplicates
    studentIds = [...new Set(studentIds)];
    
    return createClassInstance(businessId, {
      templateId,
      date,
      studentIds,
      name: template.name,
      teacherId: template.teacherId,
      startTime: template.startTime,
      duration: template.duration,
      location: template.location
    });
  }
  ```
- [ ] **Update `getInstanceEnrolledStudents()` to use `studentIds` from instance (already done)**
- [ ] **Create `addStudentToInstance(instanceId, studentId)` - for enrollment sync**
- [ ] **Create `removeStudentFromInstance(instanceId, studentId)` - for enrollment sync**
- [ ] **Create `getFutureInstances(templateId, fromDate)` - get instances after a date**
- [ ] **Create `syncInstancesWithCourseEnrollment(courseId, studentId, action, effectiveDate)` - main sync function**

### 1.5 Create Instance Generation Helper ✅ NEW FILE
**File:** `src/services/instance-generation-service.js`
- [ ] **Create `generateInstancesForDateRange(businessId, startDate, endDate)`**
- [ ] **Create `getOrGenerateInstance(businessId, templateId, date)` - create if not exists**
- [ ] **Create `regenerateInstance(instanceId)` - recalculate student list from courses**

---

## Phase 2: Database Migration

### 2.1 Update Firestore Structure
- [ ] **Clear all data (run in Firebase Console or script):**
  - Delete all documents from `classTemplates` subcollection
  - Delete all documents from `courses` subcollection
  - Delete all documents from `enrollments` subcollection
  - Delete all documents from `classInstances` subcollection
  - Delete all documents from `students` subcollection
  - Delete all documents from `teachers` subcollection

### 2.2 Update populate-db.js ✅ CRITICAL
**File:** `populate-db.js`
- [ ] **Remove `defaultStudentIds` from template creation**
- [ ] **Create sample courses with `templateIds` arrays:**
  ```javascript
  const COURSES = [
    {
      name: "Hip Hop + Jazz Intensive",
      description: "Twice a week dance program",
      templateIds: [], // Will be filled with created template IDs
      price: 500,
      startDate: null,
      endDate: null,
      status: "active"
    },
    {
      name: "Ballet Solo Class",
      description: "Single weekly ballet class",
      templateIds: [], // Single template
      price: 250,
      startDate: null,
      endDate: null,
      status: "active"
    }
  ];
  ```
- [ ] **Create enrollments linking students to courses (not templates):**
  ```javascript
  async function addEnrollments(courses, students) {
    for (const course of courses) {
      const numStudents = Math.floor(Math.random() * 20) + 10;
      const enrolledStudents = students
        .sort(() => 0.5 - Math.random())
        .slice(0, numStudents);
      
      for (const student of enrolledStudents) {
        await db.collection('studios')
          .doc(STUDIO_ID)
          .collection('enrollments')
          .add({
            studentId: student.id,
            courseId: course.id,
            enrollmentDate: Timestamp.now(),
            effectiveFrom: Timestamp.now(),
            effectiveTo: null,
            status: 'active',
            paymentStatus: 'paid'
          });
      }
    }
  }
  ```
- [ ] **Update instance creation to aggregate students from courses**
- [ ] **Test with `node populate-db.js`**

---

## Phase 3: UI Implementation - Courses Management

### 3.1 Create Courses Page ✅ NEW FILES
**File:** `public/manager/courses.html`
- [ ] **Create HTML structure:**
  - Courses grid/list view
  - Add course modal
  - Edit course modal
  - Course details modal
  - Enrollment management modal (add/remove students)
  - Template selection modal (add/remove templates)

**File:** `src/pages/manager/courses.js`
- [ ] **Implement page functionality:**
  - Load and display courses
  - CRUD operations for courses
  - Template management for courses (multi-select)
  - Student enrollment management
  - Show which templates are in each course
  - Show student count and enrollment list

**File:** `src/styles/courses.css`
- [ ] **Create styles for courses page**

### 3.2 Create Course Enrollment Modal ✅ CRITICAL
**File:** `src/pages/manager/courses.js` (within)
- [ ] **Enrollment modal with effective date picker:**
  - List of enrolled students with remove button
  - List of available students with add button
  - When adding: prompt "Enroll from which date?" (default: today)
  - When removing: prompt "Remove from which date?" (default: today)
  - Show confirmation: "Will affect X future class instances"
- [ ] **Implement `addStudentToCourseUI(courseId, studentId)`:**
  - Show date picker modal
  - Call backend `enrollStudentInCourse()` with effectiveFrom
  - Show success message with instance count
- [ ] **Implement `removeStudentFromCourseUI(courseId, studentId)`:**
  - Show date picker modal
  - Call backend `removeStudentFromCourse()` with effectiveTo
  - Show confirmation dialog
  - Show success message

### 3.3 Update Navigation
**File:** `src/components/navbar.js`
- [ ] **Add "Courses" menu item for manager role:**
  ```javascript
  { label: 'קורסים', icon: '📚', href: '/manager/courses.html' }
  ```
- [ ] **Position: Dashboard → Students → Teachers → Templates → Courses → Classes → Attendance**

### 3.4 Update Webpack Config
**File:** `webpack.config.cjs`
- [ ] **Add courses bundle:**
  ```javascript
  'manager/courses': './src/pages/manager/courses.js'
  ```

---

## Phase 4: Update Existing Pages

### 4.1 Update Templates Page ✅ REMOVE ENROLLMENT FEATURES
**File:** `public/manager/templates.html`
- [ ] **Remove enrollment management modal**
- [ ] **Remove "ניהול תלמידים" button from template details**
- [ ] **Remove enrolled students count display**
- [ ] **Add "קורסים המשתמשים בתבנית" section - show which courses use this template**

**File:** `src/pages/manager/templates.js`
- [ ] **Remove all enrollment-related functions:**
  - Remove `openManageEnrollmentsModal()`
  - Remove `renderEnrolledStudents()`
  - Remove `renderAvailableStudents()`
  - Remove `addStudentToTemplateUI()`
  - Remove `removeStudentFromTemplateUI()`
- [ ] **Add `getCoursesUsingTemplate(templateId)` to show related courses**
- [ ] **Update template details to show course count instead of student count**

### 4.2 Update Classes Page ✅ USE NEW INSTANCE GENERATION
**File:** `src/pages/manager/classes.js`
- [ ] **Update `loadAllData()` to generate instances on-demand:**
  ```javascript
  async function loadAllData() {
    const templates = await getAllClassTemplates(currentStudioId);
    classInstances = [];
    
    // Generate instances for current week
    const weekDates = getWeekDates(currentWeekStart);
    for (const date of weekDates) {
      const dayOfWeek = date.getDay();
      const dayTemplates = templates.filter(t => t.dayOfWeek === dayOfWeek);
      
      for (const template of dayTemplates) {
        const instance = await getOrGenerateInstance(currentStudioId, template.id, date);
        classInstances.push(instance);
      }
    }
    
    enrichInstancesWithTeacherNames();
    updateCounts();
  }
  ```
- [ ] **Student counts should reflect aggregated counts from courses**

### 4.3 Update Dashboard ✅ SHOW COURSES
**File:** `src/pages/manager/dashboard.js`
- [ ] **Add courses count widget**
- [ ] **Update today's classes to use generated instances**
- [ ] **Add quick actions for courses**

---

## Phase 5: Enrollment Sync Implementation

### 5.1 Create Enrollment Sync Service ✅ CRITICAL
**File:** `src/services/enrollment-sync-service.js` (NEW)
- [ ] **Create main sync function:**
  ```javascript
  async function syncEnrollmentToInstances(businessId, courseId, studentId, action, effectiveDate) {
    const course = await getCourseById(businessId, courseId);
    let affectedCount = 0;
    
    for (const templateId of course.templateIds) {
      const futureInstances = await getFutureInstances(businessId, templateId, effectiveDate);
      
      for (const instance of futureInstances) {
        if (action === 'add') {
          await addStudentToInstance(businessId, instance.id, studentId);
        } else if (action === 'remove') {
          await removeStudentFromInstance(businessId, instance.id, studentId);
        }
        affectedCount++;
      }
    }
    
    return affectedCount;
  }
  ```
- [ ] **Create `syncCourseAddition(enrollmentId)` - called when student enrolled**
- [ ] **Create `syncCourseRemoval(enrollmentId, effectiveDate)` - called when student removed**
- [ ] **Create `syncCoursePause(enrollmentId, pauseFrom, pauseTo)` - handle pauses**
- [ ] **Add error handling and rollback logic**

### 5.2 Integrate Sync with Enrollment Operations
**File:** `src/services/enrollment-service.js`
- [ ] **Update `enrollStudentInCourse()` to call sync:**
  ```javascript
  const enrollment = await createEnrollment(...);
  const affectedCount = await syncEnrollmentToInstances(businessId, courseId, studentId, 'add', effectiveFrom);
  return { enrollment, affectedInstances: affectedCount };
  ```
- [ ] **Update `removeStudentFromCourse()` to call sync:**
  ```javascript
  await updateEnrollment(...);
  const affectedCount = await syncEnrollmentToInstances(businessId, courseId, studentId, 'remove', effectiveTo);
  return { affectedInstances: affectedCount };
  ```

### 5.3 Handle Edge Cases
- [ ] **Student enrolled in multiple courses with same template:**
  - Instance should have student only once (deduplication)
  - Removing from one course shouldn't remove from instance if still in another course
- [ ] **Past instances:**
  - Never modify studentIds for past instances
  - Keep attendance history intact
- [ ] **Instance already has manual modifications:**
  - Add `isModified` flag check
  - Ask user if they want to override manual changes

---

## Phase 6: Testing & Validation

### 6.1 Unit Tests (Manual)
- [ ] **Test course creation with multiple templates**
- [ ] **Test student enrollment in course**
- [ ] **Test instance generation aggregates students correctly**
- [ ] **Test adding student to course syncs to future instances**
- [ ] **Test removing student from course syncs to future instances**
- [ ] **Test student in multiple courses appears once in instance**
- [ ] **Test past instances not affected by enrollment changes**

### 6.2 Integration Tests
- [ ] **Create 2 courses sharing 1 template**
- [ ] **Enroll different students in each course**
- [ ] **Generate instance and verify 40 students (30+10)**
- [ ] **Remove student from one course, verify instance still has them (from other course)**
- [ ] **Remove student from both courses, verify removed from instance**

### 6.3 UI/UX Testing
- [ ] **Test courses page CRUD operations**
- [ ] **Test template selection for courses**
- [ ] **Test student enrollment with date picker**
- [ ] **Test enrollment removal with date picker**
- [ ] **Test confirmation messages show correct instance counts**
- [ ] **Test calendar displays correct student counts**

---

## Phase 7: Documentation & Deployment

### 7.1 Update Documentation
- [ ] **Update README.md with new architecture**
- [ ] **Document enrollment sync behavior**
- [ ] **Create user manual for course management**
- [ ] **Document API changes for service functions**

### 7.2 Deploy to Production
- [ ] **Run `npm run build`**
- [ ] **Run `node populate-db.js` with new structure**
- [ ] **Deploy Firestore rules (if needed)**
- [ ] **Run `firebase deploy`**
- [ ] **Verify production deployment**

---

## Priority Summary

### 🔴 CRITICAL (Must Do First)
1. Phase 1: Service layer updates (all 1.x tasks)
2. Phase 2: Database migration (populate-db.js)
3. Phase 3.1-3.2: Courses page and enrollment modal
4. Phase 5.1-5.2: Enrollment sync implementation

### 🟡 HIGH (Do Second)
5. Phase 3.3-3.4: Navigation and webpack
6. Phase 4: Update existing pages
7. Phase 5.3: Edge cases

### 🟢 MEDIUM (Do Last)
8. Phase 6: Testing
9. Phase 7: Documentation and deployment

---

## Estimated Timeline
- **Phase 1-2:** 4-6 hours (service layer + migration)
- **Phase 3:** 3-4 hours (courses UI)
- **Phase 4:** 2-3 hours (update existing pages)
- **Phase 5:** 3-4 hours (sync implementation)
- **Phase 6-7:** 2-3 hours (testing + deployment)

**Total:** ~14-20 hours of development work

---

## Notes & Considerations

### Performance Optimization
- Consider caching course-template relationships
- Batch operations when syncing multiple instances
- Add indexes on `courseId`, `templateId`, `effectiveFrom`, `effectiveTo` fields

### Future Enhancements
- Background job to pre-generate instances for 3 months
- Bulk enrollment operations
- Course templates (for common course structures)
- Enrollment waitlist when course is full
- Email notifications on enrollment changes

### Breaking Changes Alert
⚠️ **This migration will DELETE all existing data**
- Templates will lose student lists
- All enrollments must be redone through courses
- Class instances will need regeneration
- Acceptable for pre-production system
