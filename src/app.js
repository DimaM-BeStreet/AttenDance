import { auth } from '@config/firebase-config';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@config/firebase-config';
import '@/styles/main.css';
import '@/styles/rtl.css';

// Check authentication state and redirect accordingly
onAuthStateChanged(auth, async (user) => {
  if (user) {
    // User is signed in, get their role
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const role = userData.role;
        
        // Redirect based on role
        switch (role) {
          case 'superAdmin':
            window.location.href = '/pages/superadmin/dashboard.html';
            break;
          case 'manager':
            window.location.href = '/pages/manager/dashboard.html';
            break;
          case 'teacher':
            window.location.href = '/pages/teacher/my-classes.html';
            break;
          default:
            console.error('Unknown user role:', role);
        }
      } else {
        console.error('User document not found');
      }
    } catch (error) {
      console.error('Error getting user data:', error);
    }
  } else {
    // User is signed out, stay on login page
    console.log('No user signed in');
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
