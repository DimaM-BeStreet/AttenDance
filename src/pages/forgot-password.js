/**
 * Forgot Password Page
 */

import '../styles/main.css';
import '../styles/rtl.css';
import '../styles/mobile.css';
import '../styles/auth.css';
import { auth } from '../config/firebase-config.js';
import { sendPasswordResetEmail } from 'firebase/auth';

document.addEventListener('DOMContentLoaded', () => {
    const resetForm = document.getElementById('resetForm');
    const resetBtn = document.getElementById('resetBtn');
    const spinner = resetBtn.querySelector('.btn-spinner');

    resetForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Clear messages
        document.querySelectorAll('.form-error').forEach(el => el.textContent = '');
        document.getElementById('formSuccess').style.display = 'none';

        const email = document.getElementById('email').value.trim();

        // Validation
        if (!email) {
            document.getElementById('emailError').textContent = 'נא להזין אימייל';
            return;
        }

        // Disable button
        resetBtn.disabled = true;
        spinner.style.display = 'inline-block';

        try {
            await sendPasswordResetEmail(auth, email);

            // Show success message
            const successEl = document.getElementById('formSuccess');
            successEl.textContent = 'נשלח אליך קישור לאיפוס סיסמה באימייל';
            successEl.style.display = 'block';

            // Clear form
            resetForm.reset();

        } catch (error) {
            console.error('Password reset error:', error);
            
            let errorMessage = 'שגיאה בשליחת הקישור';
            
            switch (error.code) {
                case 'auth/invalid-email':
                    errorMessage = 'כתובת אימייל לא תקינה';
                    break;
                case 'auth/user-not-found':
                    errorMessage = 'לא נמצא משתמש עם אימייל זה';
                    break;
                case 'auth/network-request-failed':
                    errorMessage = 'בעיית רשת. בדוק את החיבור לאינטרנט';
                    break;
            }

            document.getElementById('formError').textContent = errorMessage;

        } finally {
            resetBtn.disabled = false;
            spinner.style.display = 'none';
        }
    });
});
