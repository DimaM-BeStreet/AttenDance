# AttenDance - Dance Studio Management System

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
- **Business Level**: Each dance studio/activity center operates independently
- **Isolation**: Complete data separation between businesses

### User Roles & Permissions

#### 1. Super Admin (System Level)
- Manage all businesses in the system
- View system-wide analytics
- Create new businesses

#### 2. Business Manager (Business Level)
- Full control over their business
- Manage students, teachers, classes, courses
- Enroll students in courses/classes
- View attendance reports and analytics
- Handle incomplete student registrations
- Manage business settings

#### 3. Teacher (Limited Access)
- Access via unique permanent link (no password login)
- View only their assigned classes
- Mark student attendance
- Quick-add new students (name + phone only)
- Cannot enroll students in courses

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

### Collection: `students`
```
businesses/{businessId}/students/{studentId}
  - firstName: string
  - lastName: string
  - phone: string
  - parentName: string
  - parentPhone: string
  - parentEmail: string
  - birthDate: timestamp
  - address: string
  - medicalNotes: string
  - enrollmentDate: timestamp
  - photoURL: string (optional - Firebase Storage path)
  - isActive: boolean
  - isIncomplete: boolean (quick-added by teacher)
  - addedBy: string (userId or teacherId)
  - createdAt: timestamp
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

### Collection: `danceStyles`
```
businesses/{businessId}/danceStyles/{styleId}
  - name: string
  - description: string
  - createdAt: timestamp
```

### Collection: `classTemplates`
```
businesses/{businessId}/classTemplates/{templateId}
  - name: string
  - dayOfWeek: number (0-6, Sunday-Saturday)
  - startTime: string (HH:MM)
  - endTime: string (HH:MM)
  - teacherId: string (reference)
  - styleId: string (reference)
  - maxStudents: number
  - room: string
  - recurrenceRule: string ('weekly' | 'biweekly' | 'monthly')
  - defaultStudentIds: array<string> (enrolled students)
  - isActive: boolean
  - createdAt: timestamp
```

### Collection: `classInstances`
```
businesses/{businessId}/classInstances/{instanceId}
  - templateId: string (reference, null for one-time classes)
  - name: string (inherited or custom)
  - date: timestamp (specific date of this session)
  - startTime: string (HH:MM, can override template)
  - endTime: string (HH:MM, can override template)
  - teacherId: string (reference, can override for substitution)
  - styleId: string (reference)
  - room: string
  - status: string ('scheduled' | 'cancelled' | 'moved' | 'completed')
  - studentIds: array<string> (can differ from template for makeups/trials)
  - notes: string (e.g., "Holiday - moved 1 hour early")
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
  - role: string ('superAdmin' | 'manager' | 'teacher')
  - businessId: string (null for superAdmin)
  - teacherId: string (if role is teacher)
  - displayName: string
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

## Key Features

### Phase 1 (Current Scope)
1. **Business Management**
   - Create/edit business profile
   - View dashboard with key metrics

2. **Student Management**
   - Add/edit/deactivate students
   - View student list with search/filter
   - Handle incomplete registrations (teacher quick-adds)

3. **Teacher Management**
   - Add/edit/deactivate teachers
   - Generate unique permanent access links
   - Assign teachers to classes

4. **Class Management**
   - Create/edit class templates (recurring schedule)
   - Auto-generate class instances for next 3 months
   - Modify individual class instances (time, teacher, cancel)
   - Assign teachers and dance styles
   - View class rosters
   - Handle holidays and schedule changes

5. **Course Management**
   - Create courses as collections of classes
   - Manage course details and duration

6. **Enrollment System**
   - Enroll students in courses (all classes)
   - Enroll students in single classes
   - View enrollment status

7. **Attendance Tracking**
   - Teacher interface: mark attendance via unique link
   - Teacher quick-add new students
   - View attendance history
   - Generate attendance reports
   - Calculate attendance rates

8. **Authentication**
   - Firebase Auth for managers
   - Token-based access for teachers (no login)
   - Role-based access control

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
│   ├── css/
│   │   ├── main.css (global styles)
│   │   ├── rtl.css (RTL support)
│   │   ├── dashboard.css
│   │   ├── forms.css
│   │   └── mobile.css
│   ├── js/
│   │   ├── config/
│   │   │   └── firebase-config.js
│   │   ├── services/
│   │   │   ├── auth-service.js
│   │   │   ├── business-service.js
│   │   │   ├── student-service.js
│   │   │   ├── teacher-service.js
│   │   │   ├── class-template-service.js
│   │   │   ├── class-instance-service.js
│   │   │   ├── course-service.js
│   │   │   ├── enrollment-service.js
│   │   │   └── attendance-service.js
│   │   ├── utils/
│   │   │   ├── date-utils.js
│   │   │   ├── validation-utils.js
│   │   │   └── storage-utils.js
│   │   ├── components/
│   │   │   ├── navbar.js
│   │   │   ├── modal.js
│   │   │   ├── table.js
│   │   │   └── form-builder.js
│   │   └── app.js (main entry point)
│   ├── pages/
│   │   ├── manager/
│   │   │   ├── dashboard.html
│   │   │   ├── students.html
│   │   │   ├── teachers.html
│   │   │   ├── classes.html
│   │   │   ├── courses.html
│   │   │   ├── enrollments.html
│   │   │   ├── attendance-reports.html
│   │   │   └── settings.html
│   │   ├── teacher/
│   │   │   ├── my-classes.html
│   │   │   └── mark-attendance.html
│   │   └── superadmin/
│   │       ├── dashboard.html
│   │       └── businesses.html
│   └── assets/
│       ├── images/
│       └── icons/
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
- Managers: Full access to their business data only
- Teachers: Read-only access to their classes and students
- Proper validation on all writes
- No public access without authentication

### Teacher Link Security
- Links contain unique tokens (UUID)
- Token mapped to specific teacher + business
- Validated on each request
- Rate limiting via Firebase Functions
- Optional: expirable tokens with refresh mechanism

## Development Phases

### Phase 1.1: Setup & Authentication (Week 1)
- Initialize Firebase project
- Setup authentication for managers
- Create basic landing page and login
- Implement role-based routing

### Phase 1.2: Business & User Management (Week 1-2)
- Business CRUD operations
- Teacher management with link generation
- Student management
- Dance styles management

### Phase 1.3: Classes & Courses (Week 2-3)
- Class creation and scheduling
- Course creation and class assignment
- Enrollment system

### Phase 1.4: Attendance System (Week 3-4)
- Teacher attendance interface (link-based)
- Quick-add student feature
- Attendance history and reports
- Incomplete student management

### Phase 1.5: Dashboard & Analytics (Week 4-5)
- Business dashboard with metrics
- Attendance reports and analytics
- Search and filtering throughout

### Phase 1.6: Polish & Testing (Week 5-6)
- Mobile responsiveness
- Error handling
- Performance optimization
- User testing and feedback

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
