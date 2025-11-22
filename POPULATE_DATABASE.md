# How to Populate Database with Sample Data

## Prerequisites
You need a Firebase Admin SDK service account key to run the populate script.

## Step 1: Download Service Account Key

1. Go to Firebase Console: https://console.firebase.google.com/project/attendance-6e07e/settings/serviceaccounts/adminsdk

2. Click the **"Generate new private key"** button

3. Save the downloaded JSON file as `serviceAccountKey.json` in the root directory of this project (`c:\Dima\HarshamotSystem\`)

**Important:** Never commit this file to Git! It contains sensitive credentials.

## Step 2: Run the Population Script

```powershell
npm run populate
```

Or directly:

```powershell
node populate-db.js
```

## What Gets Created

The script will create:

- **1 Business**: "סטודיו אורבני פלייסי" (ID: demo-Business-001)
- **1 Manager User**: 
  - Email: `manager@attendance.com`
  - Password: `Manager123!`
- **8 Students**: Sara, Yael, Noa, Tamar, Michal, Ronit, Lior, Eden
- **3 Teachers**: Michal (Ballet), Dana (Hip Hop), Ron (Jazz)
- **5 Class Templates**: Ballet, Hip Hop, Jazz, Modern, Advanced Ballet
- **~35 Class Instances**: For the next 7 days
- **Attendance Records**: Sample attendance for past classes

## Step 3: Login

After the script completes, go to:
https://attendance-6e07e.web.app

Login with:
- **Email**: manager@attendance.com
- **Password**: Manager123!

## Troubleshooting

### Error: "serviceAccountKey.json not found"
- Make sure you downloaded the file from Firebase Console
- Save it as `serviceAccountKey.json` (exact name)
- Place it in `c:\Dima\HarshamotSystem\` directory

### Error: "Email already in use"
- The manager user already exists
- Just login with the existing credentials
- Or delete the user from Firebase Console → Authentication

### Error: "Permission denied"
- Check Firestore security rules
- Make sure the service account has admin privileges

## Security Note

**⚠️ IMPORTANT**: The `serviceAccountKey.json` file is listed in `.gitignore` and should NEVER be committed to Git. It contains full admin access to your Firebase project.
