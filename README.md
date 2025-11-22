# AttenDance - Dance Business management System

A multi-tenant SaaS platform for managing dance studios and activity centers with attendance tracking, class scheduling, and student management.

## 🚀 Quick Start

### Prerequisites
- Node.js (v18 or higher)
- Firebase CLI (`npm install -g firebase-tools`)
- Git

### Firebase Project Setup

1. **Create Firebase Project**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Click "Add Project"
   - Project name: `attendance` (or your preferred name)
   - Enable Google Analytics (optional)
   - Create project

2. **Enable Firebase Services**
   - **Authentication**: Enable Email/Password provider
   - **Firestore Database**: Create database in production mode
   - **Hosting**: Enable hosting
   - **Functions**: Upgrade to Blaze plan (pay-as-you-go) for Cloud Functions

3. **Get Firebase Configuration**
   - Go to Project Settings → General
   - Scroll to "Your apps" → Click Web icon (</>)
   - Register app: `AttenDance-Web`
   - Copy the Firebase configuration object

4. **Create Firebase Config File**
   ```javascript
   // public/js/config/firebase-config.js
   const firebaseConfig = {
     apiKey: "YOUR_API_KEY",
     authDomain: "YOUR_AUTH_DOMAIN",
     projectId: "YOUR_PROJECT_ID",
     storageBucket: "YOUR_STORAGE_BUCKET",
     messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
     appId: "YOUR_APP_ID"
   };
   
   export { firebaseConfig };
   ```

### Installation

```powershell
# Clone repository
git clone https://github.com/DimaM-BeStreet/AttenDance.git
cd AttenDance

# Install dependencies
npm install
cd functions
npm install
cd ..

# Setup environment variables
cp .env.example .env
# Edit .env with your Firebase configuration

# Build the project
npm run build

# Deploy to Firebase
firebase login
firebase init
firebase deploy
```

### Environment Variables

Create a `.env` file in the root directory with your Firebase configuration:

```bash
# Clone the repository
git clone https://github.com/DimaM-BeStreet/AttenDance.git
cd AttenDance

# Install dependencies
npm install

# Install Firebase Functions dependencies
cd functions
npm install
cd ..

# Login to Firebase
firebase login

# Initialize Firebase (if not already done)
firebase init

# Select:
# - Firestore
# - Functions (JavaScript)
# - Hosting
# - (Use existing project - select your project)
```

### Local Development

```powershell
# Start Firebase emulators (recommended for development)
npm run serve

# This will start:
# - Firestore Emulator: http://localhost:8080
# - Functions Emulator: http://localhost:5001
# - Hosting Emulator: http://localhost:5000
```

### Deployment

```powershell
# Deploy everything
npm run deploy

# Deploy only hosting
npm run deploy:hosting

# Deploy only functions
npm run deploy:functions

# Deploy only Firestore rules
npm run deploy:rules
```

## 📁 Project Structure

```
AttenDance/
├── public/                      # Frontend files (hosted)
│   ├── index.html              # Login page
│   ├── css/                    # Stylesheets
│   │   ├── main.css           # Global styles
│   │   ├── rtl.css            # RTL support
│   │   ├── dashboard.css      # Dashboard layouts
│   │   ├── forms.css          # Form styling
│   │   └── mobile.css         # Responsive design
│   ├── js/
│   │   ├── config/
│   │   │   └── firebase-config.js  # Firebase SDK config
│   │   ├── services/          # Business logic services
│   │   ├── utils/             # Utility functions
│   │   ├── components/        # Reusable UI components
│   │   └── app.js            # Main entry point
│   ├── pages/                 # HTML pages
│   │   ├── manager/          # Manager dashboard & pages
│   │   ├── teacher/          # Teacher interface
│   │   └── superadmin/       # SuperAdmin panel
│   └── assets/               # Images, icons
├── functions/                 # Firebase Cloud Functions
│   ├── index.js              # Functions entry point
│   ├── api/                  # API endpoints
│   ├── triggers/             # Database triggers
│   └── scheduled/            # Scheduled jobs
├── firestore.rules           # Firestore security rules
├── firestore.indexes.json    # Firestore indexes
├── firebase.json             # Firebase config
└── package.json              # Dependencies

```

## 🗄️ Database Structure

See [PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md) for detailed database schema.

### Main Collections:
- `businesses` - Dance businesses/centers
- `users` - User accounts (managers, superadmin)
- `students` - Student records per business
- `teachers` - Teacher records per business
- `classTemplates` - Recurring class definitions
- `classInstances` - Specific class sessions
- `courses` - Collections of class templates
- `enrollments` - Student enrollments
- `attendance` - Attendance records
- `teacherLinks` - Teacher access tokens

## 🔐 Security

- Multi-tenant architecture with complete business isolation
- Role-based access control (SuperAdmin, Manager, Teacher)
- Firestore security rules enforce data access
- Teacher authentication via unique permanent links
- All business logic runs on secure Cloud Functions

## 🌍 Localization

- UI: Hebrew with RTL support
- Code: English (variables, functions, comments)
- Database keys: English

## 👥 User Roles

### SuperAdmin
- System-wide access
- Create and manage businesses
- View all data

### Business Manager
- Full control of their business
- Manage students, teachers, classes, courses
- Enroll students
- View reports and analytics

### Teacher
- Link-based access (no password)
- View assigned classes
- Mark attendance
- Quick-add new students

## 🎯 Key Features

- ✅ Multi-business SaaS platform
- ✅ Recurring class templates with flexible scheduling
- ✅ Individual instance modifications (cancel, reschedule, substitute teacher)
- ✅ Student enrollment in courses or recurring classes
- ✅ Teacher attendance marking interface
- ✅ Quick-add incomplete students
- ✅ Attendance tracking and analytics
- ✅ Responsive mobile-friendly design
- 🔄 Push notifications (future)
- 🔄 Payment tracking (future)

## 📝 Development Roadmap

See TODO list in the project for current development tasks.

### Phase 1 (Current)
- Core CRUD operations
- Authentication and authorization
- Class template and instance system
- Attendance tracking
- Basic reporting

### Phase 2 (Future)
- Payment tracking and billing
- Push notifications to parents
- SMS integration
- Advanced analytics
- Parent portal

## 🤝 Contributing

This is a private project. Contact the repository owner for collaboration.

## 📄 License

MIT License - see LICENSE file for details

## 📧 Contact

**Author**: Dima M  
**GitHub**: [@DimaM-BeStreet](https://github.com/DimaM-BeStreet)  
**Project**: AttenDance

---

**Built with ❤️ using Firebase and Vanilla JavaScript**
