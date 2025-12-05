# AttenDance - Dance Business management System

## Project Overview
A multi-tenant SaaS platform for managing dance studios and activity centers. The system allows multiple independent businesses to manage their students, teachers, classes, and courses with attendance tracking and communication features.

## Technology Stack
- **Frontend**: Vanilla HTML, CSS, JavaScript (ES6+)
- **Backend**: Firebase Cloud Functions (Node.js)
- **Database**: Cloud Firestore
- **Authentication**: Firebase Authentication
- **Storage**: Firebase Cloud Storage (for profile images)
- **Hosting**: Firebase Hosting
- **Notifications**: Firebase Cloud Messaging (FCM)
- **Language**: Hebrew UI (RTL), English codebase
- **Version Control**: GitHub

## Core Concepts

### Multi-Tenancy Architecture
- **System Level**: Platform hosting multiple businesses
- **Business Level**: Each dance business/activity center operates independently
- **Isolation**: Complete data separation between businesses

### User Roles & Permissions

#### 1. Super Admin (System Level)
- Full control over the business
- Manage students, teachers, classes, courses
- Enroll students in courses/classes
- View attendance reports and analytics
- **Manage users**: Create admin and teacher accounts
- View and manage temp-students (created by teachers)
- Convert temp-students to real students
- Access to Users Management page

#### 2. Admin (Business Level)
- Full control over their business data
- Manage students, teachers, classes, courses
- Enroll students in courses/classes
- View attendance reports and analytics
- **Manage temp-students**: 
  - View temp students in dashboard
  - Convert temp-students to full students (with email, birthdate, course enrollment)
  - Delete temp-students
  - Add temp students from manager attendance page
- **Cannot manage users** (cannot create admin/teacher accounts)

#### 3. Teacher (Limited Access)
- View only their assigned classes
- Mark student attendance for their classes
- **Add temp-students**: Quick-add temporary students via "+ תלמיד זמני" button
  - Modal form with name (required), phone (required), notes (optional)
  - Created via Cloud Function with teacher link validation
  - Temp-students can attend specific classes but are not enrolled in courses
  - Automatically appears in student list after creation
- **Cannot add real students** or enroll students in courses
- Cannot access student/teacher/course management pages

#### 4. Parent/Student (Future Phase)
- View attendance history
- Receive notifications
- View class schedules

## Database Structure (Firestore)

### Collection: `businesses`
```
businesses/{businessId}
  - name: string
  - managerName: string
  - managerPhone: string
  - contactPhone: string
  - idNumber: string (תעודת זהות)
  - address: string
  - email: string
  - createdAt: timestamp
  - isActive: boolean
  - settings: object
```

### Collection: `branches`
```
businesses/{businessId}/branches/{branchId}
  - name: string (branch name, e.g., "סניף תל אביב")
  - city: string
  - address: string
  - phone: string
  - managerEmail: string (for branch manager authentication)
  - branchEmail: string (general contact email)
  - isActive: boolean
  - createdAt: timestamp
  - updatedAt: timestamp
```

### Collection: `students`
```
businesses/{businessId}/students/{studentId}
  - firstName: string
  - lastName: string
  - phone: string
  - email: string
  - parentName: string
  - parentPhone: string
  - parentEmail: string
  - dateOfBirth: timestamp
  - notes: string
  - photoURL: string (optional - Firebase Storage path at businesses/{businessId}/students/{studentId}/profile.jpg)
  - isActive: boolean
  - isComplete: boolean
  - createdAt: timestamp
  - updatedAt: timestamp
  - deletedAt: timestamp (optional - for soft delete, filtered out in queries)
```

### Collection: `tempStudents` (Root Level)
```
tempStudents/{tempStudentId}
  - name: string (full name)
  - phone: string
  - notes: string (brief description/info)
  - classId: string (reference to specific class instance)
  - businessId: string (reference to business)
  - createdBy: string (teacher or admin user ID)
  - createdAt: timestamp
  - active: boolean
  - type: string ("temp")
  - businessId: string (reference to business)
  - createdBy: string (teacherId who added them)
  - createdAt: timestamp
  - active: boolean
  - convertedToStudentId: string (optional - if promoted to real student)
  - convertedAt: timestamp (optional - when promoted)
```

### Collection: `teachers`
```
businesses/{businessId}/teachers/{teacherId}
  - firstName: string
  - lastName: string
  - phone: string
  - email: string
  - idNumber: string
  - specialties: array<string> (dance styles)
  - photoURL: string (optional - Firebase Storage path)
  - uniqueLink: string (permanent access link)
  - isActive: boolean
  - createdAt: timestamp
```

### Collection: `classTemplates`
```
businesses/{businessId}/classTemplates/{templateId}
  - name: string
  - branchId: string (reference to branch, nullable)
  - teacherId: string (reference to teacher)
  - dayOfWeek: number (0-6, Sunday-Saturday)
  - startTime: string (HH:MM)
  - duration: number (in minutes)
  - location: string (reference to location ID)
  - whatsappLink: string (optional - group link)
  - isActive: boolean
  - createdAt: timestamp
  - updatedAt: timestamp
```

### Collection: `classInstances`
```
businesses/{businessId}/classInstances/{instanceId}
  - templateId: string (reference to classTemplate)
  - name: string (inherited from template)
  - branchId: string (inherited from template, nullable)
  - date: timestamp (specific date of this session)
  - startTime: string (HH:MM format)
  - teacherId: string (reference to teacher)
  - status: string ('scheduled' | 'cancelled' | 'completed')
  - studentIds: array<string> (enrolled students for this instance)
  - notes: string (optional)
  - createdAt: timestamp
  - generatedAt: timestamp (when instance was auto-generated)
```

### Collection: `courses`
```
businesses/{businessId}/courses/{courseId}
  - name: string
  - description: string
  - templateIds: array<string> (references to classTemplates)
  - startDate: timestamp
  - endDate: timestamp
  - price: number (future use)
  - isActive: boolean
  - createdAt: timestamp
```

### Collection: `enrollments`
```
businesses/{businessId}/enrollments/{enrollmentId}
  - studentId: string (reference)
  - courseId: string (reference, nullable)
  - templateId: string (reference, nullable) (for recurring class enrollment)
  - enrollmentType: string ('course' | 'recurring-class')
  - enrolledDate: timestamp
  - enrolledBy: string (managerId)
  - isActive: boolean
```

### Collection: `attendance`
```
businesses/{businessId}/attendance/{attendanceId}
  - instanceId: string (reference to classInstance)
  - studentId: string (reference)
  - date: timestamp (date of class session)
  - status: string ('present' | 'absent' | 'late' | 'excused')
  - markedBy: string (teacherId)
  - markedAt: timestamp
  - notes: string
```

### Collection: `users` (Root Level - Firebase Auth Integration)
```
users/{userId}
  - email: string
  - role: string ('superAdmin' | 'admin' | 'teacher')
  - businessId: string (null for superAdmin)
  - teacherId: string (if role is teacher)
  - displayName: string
  - active: boolean
  - createdAt: timestamp
```

### Collection: `teacherLinks` (Root Level - for link-to-teacher mapping)
```
teacherLinks/{linkToken}
  - teacherId: string
  - businessId: string
  - createdAt: timestamp
  - lastAccessed: timestamp
```

### Collection: `teacherSessions` (Root Level - validated teacher sessions)
```
teacherSessions/{firebaseAuthUID}
  - teacherId: string
  - businessId: string
  - createdAt: timestamp
  - lastAccessedAt: timestamp
  - expiresAt: timestamp (90 days from creation/renewal)
```

## Teacher Link Authentication System

### Overview
Teachers access the system via unique, secure links instead of traditional email/password authentication. This simplifies access for teachers who only need to mark attendance.

### How It Works

#### 1. Link Generation (Admin/SuperAdmin)
- When an admin creates a teacher account, the system automatically generates a unique access link
- Uses crypto.randomBytes(32) to create a secure 32-byte hex token
- Link format: `https://attendance-6e07e.web.app/teacher?link={token}`
- Token stored in root `teacherLinks` collection mapping to teacher + business
- Teacher document updated with `uniqueLink` and `linkUrl` fields
- Admin can regenerate link if needed (old link becomes invalid)

#### 2. Link Validation (Teacher Access)
- Teacher clicks their unique link
- Lands on `/teacher/index.html` authentication page
- JavaScript extracts `?link=` parameter from URL
- Calls Firebase Cloud Function `validateTeacherLink` with token
- Function checks `teacherLinks` collection:
  - If valid: returns teacherId, businessId, and teacher data
  - If invalid: returns error
  - Updates `lastAccessed` timestamp on successful validation
- On success: stores auth data in sessionStorage and localStorage
- Redirects to `/teacher/attendance.html`

#### 3. Protected Teacher Pages
- All teacher pages check for authentication on load
- Reads `teacherAuth` from sessionStorage or localStorage
- Contains: teacherId, businessId, teacherData, linkToken, authenticatedAt
- If no auth found: redirects to home page
- Teacher can logout via button (clears auth, redirects to home)

#### 4. Cloud Functions (Backend)
```javascript
// functions/api/auth-api.js
exports.generateTeacherLink = onCall(async (request) => {
  // Requires auth, checks permissions
  // Creates unique token
  // Saves to teacherLinks collection
  // Returns linkToken and URL
});

exports.validateTeacherLink = onCall(async (request) => {
  // Accepts linkToken
  // Checks teacherLinks collection
  // Updates lastAccessed timestamp
  // Returns teacherId, businessId, teacherData
});

// functions/api/teacher-api.js
exports.markAttendance = onCall(async (request) => {
  // Validates linkToken first
  // Verifies teacher belongs to business
  // Checks teacher is active
  // Creates/updates attendance record
  // Returns success status
});

exports.createTempStudent = onCall(async (request) => {
  // Validates linkToken first
  // Verifies teacher belongs to business
  // Checks teacher is active
  // Creates temp student record
  // Returns studentId and data
});
```

#### 5. Service Layer (Frontend)
```javascript
// src/services/teacher-service.js
export async function generateTeacherLink(businessId, teacherId)
export async function validateTeacherLink(linkToken)
export async function regenerateTeacherLink(businessId, teacherId)
export async function markAttendance(linkToken, classInstanceId, studentId, businessId, status, notes)
export async function createTempStudent(linkToken, studentData)
```

### Security Model
**Authentication**: Validated Anonymous Sessions
- When teacher clicks their link:
  1. Cloud Function validates linkToken
  2. System signs teacher in anonymously (Firebase Auth)
  3. Cloud Function creates `teacherSessions/{uid}` document mapping UID → teacher+business
  4. Session expires after 90 days (automatically renewed on each page load)
- Cannot steal data by just calling `signInAnonymously()` - must have valid link

**Read Operations**: Validated teacher sessions only
- Firestore rules check: `isValidatedTeacher(businessId)`
- Rules verify session document exists for UID and matches businessId
- Student data (names, phones, addresses, medical info) protected from:
  - Unauthenticated users (no Firebase Auth)
  - Authenticated users without valid teacher session
  - Teachers from other businesses (businessId mismatch)
- Frontend filters data by teacherId client-side

**Write Operations**: Via Cloud Functions Only
- Teachers CANNOT write directly to Firestore
- All writes go through Cloud Functions that validate linkToken
- Cloud Functions run with admin privileges
- Each write operation validates:
  1. Link token exists in `teacherLinks` collection
  2. Teacher belongs to specified business
  3. Teacher account is active
  4. Link hasn't expired (if expiration set)
- This prevents unauthorized writes

**Session Management**:
- `teacherSessions` collection (root level)
- Document ID = Firebase Auth UID
- Contains: teacherId, businessId, createdAt, lastAccessedAt, expiresAt (90 days)
- Session automatically renewed on each page load (extends by 90 days)
- Only Cloud Functions can create/renew sessions
- Teachers can read/delete their own session (logout)
- Firestore rules validate session on every read

### Security Considerations
- ✅ Student data fully protected (requires validated teacher session)
- ✅ Anonymous auth alone is NOT enough - must have session document
- ✅ Session validation prevents unauthorized access
- ✅ Sessions expire after 90 days of inactivity (auto-renewed on use)
- ✅ Business isolation (teacher can only access own business)
- ✅ Tokens are cryptographically secure (32 bytes = 64 hex chars)
- ✅ Links map to specific teacher + business (can't be reused)
- ✅ Write operations validated via Cloud Functions with token checks
- ✅ Teacher active status verified on each write
- ✅ Permission checks (only superAdmin/manager can generate links)
- ✅ Rate limiting via Firebase Functions built-in
- ✅ lastAccessed tracking for monitoring
- ✅ Firestore rules prevent direct writes (only Cloud Functions can write)
- ⚠️ Links don't expire (consider adding expiration in future)
- ⚠️ No IP restriction (teacher can access from any location)

### Firebase Console Setup
**No additional configuration needed!** The existing Firebase hosting setup handles everything:
- `firebase.json` has catch-all rewrite rule (`**` → `/index.html`)
- This allows `/teacher?link=...` URLs to work without 404 errors
- Static files served directly, dynamic routes handled by rewrites

## Key Features

### Phase 1 (Current Scope)
1. **User Management** (superAdmin only)
   - Add admin and teacher user accounts
   - Manage user permissions and roles
   - Generate temporary passwords for new users

2. **Business Management**
   - Create/edit business profile
   - View dashboard with key metrics
   - Role-based access control

3. **Student Management**
   - Add/edit/deactivate students (admin only)
   - View student list with search/filter
   - Temp-student system for teachers
   - **Bulk Operations**:
     - Multi-select students with checkboxes
     - Selection mode hides non-essential UI elements
     - Bulk enroll in class instances (filter by branch/teacher)
     - Bulk enroll in courses (filter by branch)

4. **Temp-Student Management**
   - Teachers can quick-add temp-students (name + phone + notes)
   - Temp-students can attend specific classes without enrollment
   - Admins/superAdmins can view all temp-students
   - Promote temp-students to real students
   - Optional: enroll promoted students in courses

5. **Teacher Management**
   - Add/edit/deactivate teachers
   - Assign teachers to classes

6. **Branch Management** (Multi-Location Support)
   - Create/manage branches (physical locations with manager & contact info)
   - Branch filtering in locations, templates, courses, and classes
   - Filter UI automatically hidden when ≤1 branch exists
   - **Architecture**:
     - Locations assigned to branches
     - Templates inherit branch from location
     - Courses are above branches (can contain templates from multiple branches)
     - Class instances inherit branch from template
   - **Course filtering**: Shows courses that contain at least one template from the selected branch

7. **Class Management**
   - Create/edit class templates (recurring schedule)
   - Modify individual class instances (time, teacher, cancel)
   - Assign teachers and dance styles
   - View class rosters
   - Handle holidays and schedule changes
   - Branch-based filtering

8. **Course Management**
   - Create courses as collections of class templates
   - Courses can span multiple branches (templates from different locations)
   - Manage course details and duration
   - Filter by branch (shows courses containing templates from that branch)

9. **Enrollment System**
   - Enroll students in courses (all classes)
   - Enroll students in single classes
   - View enrollment status

10. **Attendance Tracking**
   - Mark attendance for enrolled students
   - Mark attendance for temp-students
   - Teachers can add temp-students during attendance
   - View attendance history
   - Generate attendance reports
   - Calculate attendance rates

11. **Authentication & Authorization**
   - Firebase Auth for admins and superAdmins
   - Role-based access control
   - Permission checks on all pages

### Phase 2 (Future Enhancements)
- Payment tracking and billing
- Push notifications (attendance confirmations to parents)
- Parent portal
- SMS integration
- Advanced analytics and reporting
- Automated reminders
- Multi-language support (beyond Hebrew)

## Project Structure
```
HarshamotSystem/
├── public/
│   ├── index.html (landing/login page)
│   ├── css/ (legacy - being migrated to src/styles)
│   ├── js/ (webpack bundles output here)
│   ├── manager/
│   │   ├── dashboard.html
│   │   ├── students.html
│   │   ├── teachers.html
│   │   ├── templates.html
│   │   ├── locations.html
│   │   ├── courses.html
│   │   ├── classes.html
│   │   ├── attendance.html
│   │   └── users.html (superAdmin only)
│   └── teacher/
│       └── attendance.html
├── src/
│   ├── config/
│   │   └── firebase-config.js
│   ├── services/
│   │   ├── auth-service.js (role checks: isSuperAdmin, isAdmin, isTeacher)
│   │   ├── student-service.js ⚡ (with pagination support)
│   │   ├── course-service.js ⚡ (with pagination support)
│   │   ├── class-instance-service.js ⚡ (with pagination support)
│   │   ├── teacher-service.js ⚡ (with pagination support)
│   │   ├── class-template-service.js ⚡ (with pagination support)
│   │   ├── temp-students-service.js (new)
│   │   ├── teachers-service.js
│   │   ├── templates-service.js
│   │   ├── locations-service.js
│   │   ├── courses-service.js
│   │   ├── classes-service.js
│   │   └── attendance-service.js
│   ├── components/
│   │   └── navbar.js (role-based menu: superAdmin/admin/teacher)
│   ├── pages/
│   │   ├── login.js
│   │   ├── manager/
│   │   │   ├── dashboard.js
│   │   │   ├── students.js
│   │   │   ├── teachers.js
│   │   │   ├── templates.js
│   │   │   ├── locations.js
│   │   │   ├── courses.js
│   │   │   ├── classes.js
│   │   │   ├── attendance.js
│   │   │   ├── users.js (superAdmin only)
│   │   │   ├── *-styles.js (CSS imports for webpack)
│   │   └── teacher/
│   │       └── attendance.js
│   ├── styles/
│   │   ├── main.css (global styles)
│   │   ├── rtl.css (RTL support)
│   │   ├── mobile.css (responsive)
│   │   ├── students.css
│   │   ├── teachers.css
│   │   ├── templates.css
│   │   ├── locations.css
│   │   ├── courses.css
│   │   ├── classes.css
│   │   ├── attendance.css
│   │   └── users.css
│   └── app.js (main entry point)
├── functions/
│   ├── index.js
│   ├── package.json
│   ├── api/
│   │   ├── auth-api.js (validateTeacherLink, generateTeacherLink)
│   │   ├── business-api.js (CRUD operations)
│   │   ├── student-api.js
│   │   ├── teacher-api.js
│   │   ├── class-api.js
│   │   ├── enrollment-api.js
│   │   └── attendance-api.js
│   ├── triggers/
│   │   ├── attendance-notifications.js
│   │   └── enrollment-handlers.js
│   └── scheduled/
│       ├── generate-class-instances.js (monthly job)
│       └── reminder-jobs.js
├── firestore.rules
├── firestore.indexes.json
├── firebase.json
├── .firebaserc
├── package.json
├── .gitignore
└── README.md
```

## Security Rules Strategy

### Firestore Rules
- Super admins: Full access to all data
- Admins: Full access to their business data only
- Teachers: Read access to their classes and students, write access to attendance and temp-students
- Proper validation on all writes
- No public access without authentication
- Temp-students: Teachers can create, admins can read/update/convert

### Teacher Link Security
- Links contain unique tokens (UUID)
- Token mapped to specific teacher + business
- Validated on each request
- Rate limiting via Firebase Functions
- Optional: expirable tokens with refresh mechanism

## Development Phases

### Phase 1: Core System ✅ (Completed)
- Firebase setup and authentication
- Role-based access control (superAdmin, admin, teacher)
- Student management
- Teacher management
- Class templates and locations
- Course management
- Enrollment system
- Attendance tracking (basic)

### Phase 2: Enhanced Permissions & Temp Students ✅ (Completed)
- ✅ User management page (superAdmin only)
- ✅ Role restructure (manager → admin)
- ✅ Temp-students service and data model
- ✅ Updated navbar with role-based menus
- ✅ Attendance page: support temp-students
- ✅ Dashboard: temp-student promotion feature
- ✅ Permission checks on all pages
- ✅ Teacher UI: add temp-students during attendance
- ✅ Custom dialog component (replaces default alerts/confirms)
- ✅ Teacher link authentication system (complete frontend + backend)
- ✅ Anonymous Firebase Auth with validated teacher sessions (90-day expiration)
- ✅ Secure write operations via Cloud Functions
- ✅ Teacher attendance interface with full functionality
- ✅ Student photo modal with status buttons and notes
- ✅ Visual feedback on unsaved changes
- ✅ Attendance deduplication logic
- ✅ Classes grouped by "Today" and "Future" sections

### Phase 3: Polish & Production Ready ✅ (Completed)
- ✅ Mobile responsiveness improvements
- ✅ Error handling and user feedback
- ✅ Data validation and security rules
- ✅ Teacher attendance UI polish (modal, buttons, stats)
- ✅ User testing and bug fixes
- ✅ Documentation complete
- ✅ Production deployment active

### Phase 4: Enterprise Pagination & Performance ⚡ (Completed)
- ✅ **Cursor-Based Pagination Architecture**:
  - Service layer pagination: `getPaginated{Entity}()` functions in 5 core services
  - Firestore `startAfter()` with `limit()` queries for efficient cursor pagination
  - Returns `{items, lastDoc, hasMore, total}` structure
  - Default limit: 20 items (configurable per page)
  - Supports filters, sorting, and pagination simultaneously
- ✅ **Page-Level Implementation**:
  - Students page: 10 items per load (94% read reduction)
  - Courses page: 5 items per load
  - Classes page: 30 items per load
  - Teachers page: 30 items per load
  - Templates page: 30 items per load
  - Import Wizard: 20 items per load (server-side)
- ✅ **UI Pattern**:
  - "Load More" buttons with loading states
  - Disabled state during fetch
  - Hebrew labels ("טען עוד תלמידים", "טען עוד קורסים", etc.)
  - Auto-hide button when no more data
- ✅ **Optimizations**:
  - Bulk enrollment modals: Load 50 items max (was loading ALL)
  - Search integration: Reset to pagination on empty, disable on active search
  - Removed unnecessary data preloading (e.g., students in courses page)
  - Progressive loading: Only fetch data as needed
- ✅ **Performance Metrics**:
  - Initial page load: 94% fewer Firestore reads
  - Example: 1000 students = 10 reads instead of 1000
  - Cost savings: ~$4.34/month per 1000 page views
  - Load times: <1 second vs 3-5 seconds for large datasets
  - Scalability: Linear performance regardless of data size

### Phase 5: Business Branding & Enhanced Conversions ✅ (Completed)
- ✅ **Logo Upload Feature**: 
  - Admins can upload business logo in settings page (max 2MB, PNG/JPG/JPEG)
  - Logo stored in Firebase Storage at `logos/{businessId}/logo`
  - Logo URL saved to Firestore and displayed in navbar
  - Remove logo functionality with Storage cleanup
  - Public read access, admin write access via Storage rules
- ✅ **Temp Student Conversion Enhancements**:
  - Multi-select course enrollment during conversion (checkbox list replaces dropdown)
  - Editable name and phone fields (removed readonly restriction)
  - Date format changed to dd/mm/yyyy with validation
  - Students converted with `status: 'active'` by default
  - Fixed enrollment service integration
  - Removed hover effects for clearer UX
- ✅ **Duplicate Prevention**:
  - Phone number validation before creating temp students
  - Checks both temp students and permanent students collections
  - Shows alert with existing student name if duplicate found
  - Prevents creation of duplicate records
  - Implemented in both manager and teacher attendance pages
- ✅ **UI/UX Improvements**:
  - Self-deletion protection for users (cannot delete own account)
  - Fixed brand link navigation (direct to dashboard without login redirect)
  - RTL layout fixes for course selection
  - Course items fully clickable (not just checkbox)
  - Modal button order standardization

### Phase 5: Data Standardization & Mobile Optimization ✅ (Completed)
- ✅ **Student Status Field Standardization**:
  - Unified all student status to `isActive: boolean` (removed mixed status/active/isActive)
  - Updated all code references in dashboard, students, services
  - Database repopulated with correct format
  - Backend Cloud Functions and Firestore rules verified
- ✅ **Database Structure Updates**:
  - Flattened parent fields (parentName, parentPhone, parentEmail instead of parentContact object)
  - Updated populate-db.js with correct student structure
  - Temp student cleanup added to populate script
- ✅ **Business Branding Update**:
  - Changed business name to "סטודיו אורבני פלייסי"
  - Contact name: "אביבי אבידני"
  - Email: "Avivi.Avidani@gmail.com"
- ✅ **Students Page Redesign**:
  - Replaced filter chips with tab design (Permanent / Temp Students)
  - Tab counts with badge styling
  - Status filters (All/Active/Inactive) for permanent students only
  - Removed incomplete chip (not useful)
  - Fixed null reference errors after tab redesign
- ✅ **Mobile-First Table Design**:
  - Compact grid layout for mobile (no horizontal scrolling)
  - Photo on left (RTL), edit button on right, info in center
  - Action buttons: 36x36px vertical stack with 4px gap
  - Status badge inline with student name
  - Phone with icon, reduced vertical gaps (4px)
  - Single edit button per row (removed view button)
  - Click row to view details
- ✅ **Student Deletion System**:
  - Permanent deletion implemented (not soft delete)
  - Delete button moved from table to edit modal
  - Deletion preserves historical attendance data
  - Removes student from:
    - Photo storage (businesses/{businessId}/students/{studentId}/profile.jpg)
    - Course enrollments
    - Future class instances (date >= today)
    - Student document
  - Past attendance records remain intact for reporting
  - Fixed Storage rules to allow deletion from businesses/ path
  - Fixed Firestore rules to allow enrollment deletion and class instance updates

## GitHub Repository
- Repository: `AttenDance`
- Owner: `DimaM-BeStreet`
- Branch strategy: `main`, `develop`, feature branches
- Commit conventions: Conventional Commits

## Firebase Backend Architecture
All business logic runs on Firebase Cloud Functions to ensure:
- Secure data validation
- Consistent business rules
- Protected API endpoints
- Scheduled tasks (instance generation)
- Database triggers (notifications)
- Centralized error handling

## Notes
- All UI text in Hebrew with RTL support
- All code, variables, and database keys in English
- Mobile-first responsive design
- Progressive enhancement approach
- Accessibility considerations (ARIA labels in Hebrew)
