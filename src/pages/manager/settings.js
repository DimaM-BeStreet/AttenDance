/**
 * Settings Page
 * Manage business details, account security, and admin users
 */

import './settings-styles.js';
import { auth, db, storage } from '../../config/firebase-config.js';
import { createNavbar } from '../../components/navbar.js';
import { showModal, closeModal, showConfirm, showToast } from '../../components/modal.js';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { 
  updatePassword, 
  EmailAuthProvider, 
  reauthenticateWithCredential,
  onAuthStateChanged
} from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { getCurrentUser } from '../../services/auth-service.js';

let currentUser = null;
let currentBusinessId = null;
let currentLogoUrl = null;
let selectedLogoFile = null;

document.addEventListener('DOMContentLoaded', () => {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      showToast('אין לך הרשאה לגשת לדף זה', 'error');
      window.location.href = '/login.html';
      return;
    }

    try {
      // Get user data
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.data();
      
      if (!userData || (userData.role !== 'admin' && userData.role !== 'superAdmin')) {
        showToast('רק מנהלים יכולים לגשת לדף זה', 'error');
        window.location.href = '/manager/dashboard.html';
        return;
      }

      currentUser = {
        uid: user.uid,
        email: user.email,
        role: userData.role,
        businessId: userData.businessId,
        displayName: userData.displayName
      };
      currentBusinessId = userData.businessId;
    
      createNavbar();
      await loadBusinessDetails();

      // Event listeners
      document.getElementById('businessForm').addEventListener('submit', handleBusinessUpdate);
      document.getElementById('passwordForm').addEventListener('submit', handlePasswordChange);
      document.getElementById('manageUsersBtn').addEventListener('click', () => {
        window.location.href = '/manager/users.html';
      });
      
      // Logo upload listeners
      document.getElementById('uploadLogoBtn').addEventListener('click', () => {
        document.getElementById('logoInput').click();
      });
      document.getElementById('logoInput').addEventListener('change', handleLogoSelection);
      document.getElementById('removeLogoBtn').addEventListener('click', handleRemoveLogo);

    } catch (error) {
      console.error('Error initializing settings page:', error);
      showToast('שגיאה בטעינת הדף', 'error');
    }
  });
});

/**
 * Load business details
 */
async function loadBusinessDetails() {
  try {
    const businessDoc = await getDoc(doc(db, 'businesses', currentBusinessId));
    
    if (businessDoc.exists()) {
      const business = businessDoc.data();
      document.getElementById('businessName').value = business.name || '';
      document.getElementById('contactName').value = business.contactName || '';
      document.getElementById('businessPhone').value = business.phone || '';
      document.getElementById('businessEmail').value = business.email || '';
      
      // Load logo if exists
      if (business.logoUrl) {
        currentLogoUrl = business.logoUrl;
        displayLogoPreview(business.logoUrl);
        document.getElementById('removeLogoBtn').style.display = 'inline-block';
      }
    }
  } catch (error) {
    console.error('Error loading business details:', error);
    showToast('שגיאה בטעינת פרטי העסק', 'error');
  }
}

/**
 * Handle logo file selection
 */
function handleLogoSelection(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  // Validate file type
  if (!file.type.startsWith('image/')) {
    showToast('נא לבחור קובץ תמונה בלבד', 'error');
    return;
  }
  
  // Validate file size (max 2MB)
  if (file.size > 2 * 1024 * 1024) {
    showToast('גודל הקובץ חייב להיות קטן מ-2MB', 'error');
    return;
  }
  
  selectedLogoFile = file;
  
  // Show preview
  const reader = new FileReader();
  reader.onload = (e) => {
    displayLogoPreview(e.target.result);
    document.getElementById('removeLogoBtn').style.display = 'inline-block';
  };
  reader.readAsDataURL(file);
}

/**
 * Display logo preview
 */
function displayLogoPreview(url) {
  const previewContainer = document.getElementById('logoPreview');
  previewContainer.innerHTML = `<img src="${url}" alt="Logo" class="logo-preview-image">`;
}

/**
 * Handle logo removal
 */
async function handleRemoveLogo() {
  if (!await showConfirm({ title: 'הסרת לוגו', message: 'האם אתה בטוח שברצונך להסיר את הלוגו?' })) {
    return;
  }
  
  showToast('מסיר לוגו...', 'info');

  try {
    // If there's a logo in storage, delete it
    if (currentLogoUrl) {
      const logoRef = ref(storage, `logos/${currentBusinessId}/logo`);
      try {
        await deleteObject(logoRef);
      } catch (error) {
        // Ignore error if file doesn't exist
        console.log('Logo file not found in storage, continuing...');
      }
    }
    
    // Update Firestore
    await updateDoc(doc(db, 'businesses', currentBusinessId), {
      logoUrl: null
    });
    
    // Clear UI
    document.getElementById('logoPreview').innerHTML = '';
    document.getElementById('logoInput').value = '';
    document.getElementById('removeLogoBtn').style.display = 'none';
    selectedLogoFile = null;
    currentLogoUrl = null;
    
    showToast('הלוגו הוסר בהצלחה');
    
    // Refresh navbar to update logo
    createNavbar();
  } catch (error) {
    console.error('Error removing logo:', error);
    showToast('שגיאה בהסרת הלוגו', 'error');
  }
}

/**
 * Handle business details update
 */
async function handleBusinessUpdate(e) {
  e.preventDefault();
  
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> שומר...';
  
  try {
    // Upload logo if a new one was selected
    if (selectedLogoFile) {
      const logoRef = ref(storage, `logos/${currentBusinessId}/logo`);
      await uploadBytes(logoRef, selectedLogoFile);
      const logoUrl = await getDownloadURL(logoRef);
      currentLogoUrl = logoUrl;
      selectedLogoFile = null;
    }
    
    const updates = {
      name: document.getElementById('businessName').value.trim(),
      contactName: document.getElementById('contactName').value.trim(),
      phone: document.getElementById('businessPhone').value.trim(),
      email: document.getElementById('businessEmail').value.trim(),
      updatedAt: new Date()
    };
    
    // Include logo URL if it exists
    if (currentLogoUrl) {
      updates.logoUrl = currentLogoUrl;
    }
    
    await updateDoc(doc(db, 'businesses', currentBusinessId), updates);
    showToast('הפרטים עודכנו בהצלחה');
    
    // Refresh navbar to show updated logo
    createNavbar();
    
  } catch (error) {
    console.error('Error updating business details:', error);
    showToast('שגיאה בעדכון הפרטים', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;
  }
}

/**
 * Handle password change
 */
async function handlePasswordChange(e) {
  e.preventDefault();
  
  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  
  if (newPassword !== confirmPassword) {
    showToast('הסיסמאות החדשות אינן תואמות', 'error');
    return;
  }
  
  if (newPassword.length < 6) {
    showToast('הסיסמה חייבת להכיל לפחות 6 תווים', 'error');
    return;
  }
  
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> משנה סיסמה...';
  
  try {
    const user = auth.currentUser;
    
    // Re-authenticate user
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    
    // Update password
    await updatePassword(user, newPassword);
    
    showToast('הסיסמה שונתה בהצלחה');
    document.getElementById('passwordForm').reset();
    
  } catch (error) {
    console.error('Error changing password:', error);
    if (error.code === 'auth/wrong-password') {
      showToast('הסיסמה הנוכחית שגויה', 'error');
    } else if (error.code === 'auth/weak-password') {
      showToast('הסיסמה החדשה חלשה מדי', 'error');
    } else {
      showToast('שגיאה בשינוי הסיסמה', 'error');
    }
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;
  }
}


