import { auth } from '@config/firebase-config';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@config/firebase-config';
import '@/styles/main.css';
import '@/styles/rtl.css';
import '@/styles/mobile.css';

/**
 * Authentication State Management
 * Redirects users based on role and page access
 */
onAuthStateChanged(auth, async (user) => {
  const currentPath = window.location.pathname;
  
  // Public pages that don't require authentication
  const publicPages = ['/login.html', '/forgot-password.html', '/teacher/attendance.html'];
  const isPublicPage = publicPages.some(page => currentPath.includes(page));
  
  if (user) {
    // User is signed in
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      
      if (!userDoc.exists()) {
        console.error('User document not found');
        return;
      }
      
      const userData = userDoc.data();
      const role = userData.role;
      
      // If on login page, redirect to appropriate dashboard
      if (currentPath.includes('/login.html')) {
        switch (role) {
          case 'superAdmin':
            window.location.href = '/superadmin/dashboard.html';
            break;
          case 'manager':
            window.location.href = '/manager/dashboard.html';
            break;
          case 'teacher':
            window.location.href = '/manager/dashboard.html'; // Teachers also use manager pages
            break;
          default:
            console.error('Unknown user role:', role);
        }
      }
      
      // Role-based access control for protected pages
      if (currentPath.includes('/manager/') && role !== 'manager' && role !== 'teacher' && role !== 'superAdmin') {
        window.location.href = '/login.html';
      }
      
    } catch (error) {
      console.error('Error getting user data:', error);
    }
  } else {
    // User is signed out
    // Redirect to login if trying to access protected pages
    if (!isPublicPage && !currentPath.includes('/login.html')) {
      window.location.href = '/login.html';
    }
  }
});

// Login form handler
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('error');
    const submitBtn = loginForm.querySelector('button[type="submit"]');
    
    try {
      submitBtn.disabled = true;
      submitBtn.textContent = 'מתחבר...';
      errorDiv.textContent = '';
      
      const { signInWithEmailAndPassword } = await import('firebase/auth');
      await signInWithEmailAndPassword(auth, email, password);
      
      // onAuthStateChanged will handle the redirect
    } catch (error) {
      console.error('Login error:', error);
      
      let errorMessage = 'שגיאה בהתחברות';
      if (error.code === 'auth/invalid-email') {
        errorMessage = 'כתובת אימייל לא תקינה';
      } else if (error.code === 'auth/user-not-found') {
        errorMessage = 'משתמש לא קיים';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'סיסמה שגויה';
      } else if (error.code === 'auth/invalid-credential') {
        errorMessage = 'אימייל או סיסמה שגויים';
      }
      
      errorDiv.textContent = errorMessage;
      submitBtn.disabled = false;
      submitBtn.textContent = 'התחבר';
    }
  });
}
