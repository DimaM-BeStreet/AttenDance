# Teacher Link System - Quick Reference

## For Admins/SuperAdmins

### Creating a Teacher with a Link
1. Go to **Users Management** page (superAdmin only) or **Teachers** page
2. Click "הוסף מורה" (Add Teacher)
3. Fill in teacher details (name, phone, etc.)
4. Click "צור חשבון" (Create Account)
5. System automatically generates a unique access link
6. Copy the link from the teacher's profile or list view
7. Send the link to the teacher via WhatsApp, SMS, or email

### Viewing Teacher Links
- In the teachers list, each teacher card shows their unique link
- Click the 📋 copy icon to copy the link
- Link format: `https://attendance-6e07e.web.app/teacher?link={token}`

### Regenerating a Link
- Click "צור קישור חדש" (Generate New Link) on the teacher's profile
- Old link becomes immediately invalid
- New link is generated and displayed
- Send the new link to the teacher

## For Teachers

### First Time Access
1. Receive your unique access link from the admin (via WhatsApp/SMS/Email)
2. Click the link on your phone or computer
3. Wait for validation (should take 1-2 seconds)
4. You'll be automatically logged in and redirected to the attendance page

### Returning Access
- Click the same link again anytime you need to access the system
- Your authentication persists in the browser, so you may not need to re-authenticate
- If you cleared your browser data, just click the link again

### Marking Attendance
1. After clicking your link, you'll see a list of your upcoming classes (next 7 days)
2. Select a class to mark attendance
3. Mark each student as: נוכח (Present), נעדר (Absent), איחור (Late), or מאושר (Excused)
4. Add notes if needed
5. Click "שמור נוכחות" (Save Attendance)
6. Done! You can go back to select another class or logout

### Adding Temp Students
- While marking attendance, click "הוסף תלמיד זמני" (Add Temp Student)
- Enter: name, phone, and optional notes
- Temp student is added to the current class only
- Admin can later convert them to regular students

### Logout
- Click the "יציאה" (Exit) button in the top-right corner
- You'll be logged out and redirected to the home page
- Use your link again to log back in

## Technical Details

### Link Structure
```
https://attendance-6e07e.web.app/teacher?link={64-character-hex-token}
```

### How Links Work
- Each link contains a unique 64-character token
- Token is mapped to your specific teacher account and business
- Token is validated by the backend when you click the link
- If valid: you're authenticated and can access your classes
- If invalid: you'll see an error message

### Link Security
- ✅ Links are unique and tied to your specific account
- ✅ Links are cryptographically secure (64-character hex)
- ✅ Old links become invalid when a new one is generated
- ✅ Each access is logged (lastAccessed timestamp)
- ⚠️ Don't share your link with others
- ⚠️ If you suspect your link is compromised, ask admin to regenerate

### Troubleshooting

**"הקישור אינו תקין" (Link is invalid)**
- Your link may have expired or been replaced
- Ask the admin to generate a new link for you
- Make sure you copied the complete link (64 characters after `?link=`)

**Redirected to home page when accessing attendance**
- Your browser session expired
- Click your unique link again to re-authenticate
- If problem persists, clear browser cache and try again

**Can't see any classes**
- You may not have any classes scheduled in the next 7 days
- Check with the admin that classes are properly scheduled
- Make sure you're assigned as the teacher for those classes

**"שגיאה בטעינת השיעורים" (Error loading classes)**
- Check your internet connection
- Try refreshing the page
- If problem persists, contact the admin

## Best Practices

### For Admins
- 📱 Send teacher links via WhatsApp for easy mobile access
- 📝 Keep a record of which teachers have received their links
- 🔄 Regenerate links if a teacher reports access issues
- 📊 Monitor lastAccessed timestamps to see teacher activity
- 🔒 Educate teachers not to share their links

### For Teachers
- 🔖 Bookmark your link in your browser for quick access
- 📱 Save the link in your phone's notes or messages
- 🚫 Don't share your link with anyone
- ✅ Mark attendance promptly after each class
- 💬 Use the notes field for important attendance details
- 🚪 Logout when using a shared computer

## Examples

### Admin Creates Teacher
```
1. Admin clicks "הוסף מורה"
2. Enters: "Sarah Cohen", phone: "050-1234567"
3. System generates: https://attendance-6e07e.web.app/teacher?link=a1b2c3d4e5f6...
4. Admin copies link and sends via WhatsApp to Sarah
```

### Teacher Accesses System
```
1. Sarah receives WhatsApp: "Hi Sarah, here's your attendance link: https://..."
2. Sarah clicks the link
3. Browser opens, shows "מאמת את הקישור שלך..." (Validating your link...)
4. Validation succeeds: "אימות הצליח!" (Authentication succeeded!)
5. Redirects to attendance page
6. Sarah sees her upcoming classes
7. Clicks on "Jazz - Monday 18:00"
8. Marks attendance for students
9. Clicks "שמור נוכחות"
10. Done! Optionally clicks "יציאה" to logout
```

### Admin Regenerates Link
```
1. Teacher reports: "My link stopped working"
2. Admin goes to Teachers page
3. Finds the teacher's card
4. Clicks "צור קישור חדש" (Generate New Link)
5. System creates new link: https://attendance-6e07e.web.app/teacher?link=x9y8z7w6v5u4...
6. Old link is now invalid
7. Admin sends new link to teacher
8. Teacher can access with new link
```

## API Reference (For Developers)

### Cloud Functions
```javascript
// Generate a new teacher link (requires auth + permissions)
const generateLink = httpsCallable(functions, 'generateTeacherLink');
const result = await generateLink({ businessId, teacherId });
// Returns: { linkToken: string, url: string }

// Validate a teacher link (no auth required)
const validateLink = httpsCallable(functions, 'validateTeacherLink');
const result = await validateLink({ linkToken });
// Returns: { success: boolean, teacherId: string, businessId: string, teacherData: object, error?: string }
```

### Frontend Service Layer
```javascript
import { generateTeacherLink, validateTeacherLink, regenerateTeacherLink } from './services/teacher-service.js';

// Generate link when creating teacher
const linkData = await generateTeacherLink(businessId, teacherId);
console.log(linkData.url); // Full URL
console.log(linkData.linkToken); // Token only

// Validate link on teacher login page
const result = await validateTeacherLink(linkToken);
if (result.success) {
  sessionStorage.setItem('teacherAuth', JSON.stringify({
    teacherId: result.teacherId,
    businessId: result.businessId,
    teacherData: result.teacherData,
    linkToken: linkToken,
    authenticatedAt: new Date().toISOString()
  }));
}

// Regenerate link for existing teacher
const newLinkData = await regenerateTeacherLink(businessId, teacherId);
console.log(newLinkData.url); // New URL
```

### Authentication Check in Protected Pages
```javascript
function checkTeacherAuth() {
  let authData = sessionStorage.getItem('teacherAuth');
  if (!authData) authData = localStorage.getItem('teacherAuth');
  
  if (!authData) {
    window.location.href = '/';
    return null;
  }
  
  const auth = JSON.parse(authData);
  if (!auth.teacherId || !auth.businessId) {
    window.location.href = '/';
    return null;
  }
  
  return auth;
}

// Use at start of every teacher page
const teacherAuth = checkTeacherAuth();
if (!teacherAuth) return;
```

## Database Schema

### `teacherLinks` Collection (Root Level)
```javascript
{
  "teacherLinks": {
    "a1b2c3d4e5f6...": {
      "teacherId": "teacher123",
      "businessId": "studio456",
      "createdAt": Timestamp,
      "lastAccessed": Timestamp
    }
  }
}
```

### Teacher Document Update
```javascript
{
  "businesses/studio456/teachers/teacher123": {
    "firstName": "Sarah",
    "lastName": "Cohen",
    "phone": "050-1234567",
    "uniqueLink": "a1b2c3d4e5f6...",
    "linkUrl": "https://attendance-6e07e.web.app/teacher?link=a1b2c3d4e5f6...",
    // ... other fields
  }
}
```

---

**Need help?** Contact the system administrator or check the PROJECT_OVERVIEW.md for more technical details.
