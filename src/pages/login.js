/**
 * Login Page
 */

import '../styles/main.css';
import '../styles/rtl.css';
import '../styles/mobile.css';
import '../styles/auth.css';
import { auth } from '../config/firebase-config.js';
import { signInWithEmailAndPassword, setPersistence, browserLocalPersistence, browserSessionPersistence } from 'firebase/auth';

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const loginBtn = document.getElementById('loginBtn');
    const spinner = loginBtn.querySelector('.btn-spinner');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Clear errors
        document.querySelectorAll('.form-error').forEach(el => el.textContent = '');

        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const rememberMe = document.getElementById('rememberMe').checked;

        // Validation
        if (!email) {
            document.getElementById('emailError').textContent = 'נא להזין אימייל';
            return;
        }

        if (!password) {
            document.getElementById('passwordError').textContent = 'נא להזין סיסמה';
            return;
        }

        // Disable button
        loginBtn.disabled = true;
        spinner.style.display = 'inline-block';

        try {
            // Set persistence
            await setPersistence(
                auth,
                rememberMe ? browserLocalPersistence : browserSessionPersistence
            );

            // Sign in
            await signInWithEmailAndPassword(auth, email, password);

            // Redirect will be handled by app.js based on user role

        } catch (error) {
            console.error('Login error:', error);
            
            let errorMessage = 'שגיאה בהתחברות';
            
            switch (error.code) {
                case 'auth/invalid-email':
                    errorMessage = 'כתובת אימייל לא תקינה';
                    break;
                case 'auth/user-disabled':
                    errorMessage = 'משתמש זה הושבת';
                    break;
                case 'auth/user-not-found':
                case 'auth/wrong-password':
                    errorMessage = 'אימייל או סיסמה שגויים';
                    break;
                case 'auth/too-many-requests':
                    errorMessage = 'יותר מדי ניסיונות. נסה שוב מאוחר יותר';
                    break;
                case 'auth/network-request-failed':
                    errorMessage = 'בעיית רשת. בדוק את החיבור לאינטרנט';
                    break;
            }

            document.getElementById('formError').textContent = errorMessage;

        } finally {
            loginBtn.disabled = false;
            spinner.style.display = 'none';
        }
    });
});
