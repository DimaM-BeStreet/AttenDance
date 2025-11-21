/**
 * Teacher Authentication Page
 * Validates teacher access link and redirects to attendance page
 */

import { auth } from '../../config/firebase-config.js';
import { signInAnonymously } from 'firebase/auth';
import { validateTeacherLink, createTeacherSession } from '../../services/teacher-service.js';

const loadingState = document.getElementById('loadingState');
const errorState = document.getElementById('errorState');
const successState = document.getElementById('successState');
const errorMessage = document.getElementById('errorMessage');

async function authenticateTeacher() {
    try {
        // Extract link token from URL
        const urlParams = new URLSearchParams(window.location.search);
        const linkToken = urlParams.get('link');

        if (!linkToken) {
            showError('לא נמצא קוד אימות בקישור. אנא ודא שהקישור שלם.');
            return;
        }

        // Validate the teacher link first
        console.log('Validating teacher link:', linkToken);
        const result = await validateTeacherLink(linkToken);

        // Sign in anonymously to get Firebase Auth session
        console.log('Signing in anonymously...');
        const userCredential = await signInAnonymously(auth);
        const uid = userCredential.user.uid;

        // Create validated session in Firestore (via Cloud Function)
        console.log('Creating validated session...');
        await createTeacherSession(linkToken, uid);

        // Store teacher authentication data
        const teacherAuth = {
            teacherId: result.teacherId,
            businessId: result.businessId,
            teacherData: result.teacherData,
            linkToken: linkToken,
            authenticatedAt: new Date().toISOString()
        };

        sessionStorage.setItem('teacherAuth', JSON.stringify(teacherAuth));
        localStorage.setItem('teacherAuth', JSON.stringify(teacherAuth));

        // Show success and redirect
        loadingState.style.display = 'none';
        successState.style.display = 'flex';

        setTimeout(() => {
            window.location.href = '/teacher/attendance.html';
        }, 1500);

    } catch (error) {
        console.error('Authentication error:', error);
        showError('שגיאה בתהליך האימות. אנא נסה שנית או פנה למנהל המערכת.');
    }
}

function showError(message) {
    loadingState.style.display = 'none';
    errorState.style.display = 'flex';
    errorMessage.textContent = message;
}

// Start authentication on page load
document.addEventListener('DOMContentLoaded', authenticateTeacher);
