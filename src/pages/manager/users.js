/**
 * Users Management Page
 * For superAdmin only - manage admin and teacher accounts
 */

import { auth, db, app } from '../../config/firebase-config.js';
import { createNavbar } from '../../components/navbar.js';
import { showModal, closeModal, showConfirm, showToast } from '../../components/modal.js';
import { createUserWithEmailAndPassword, onAuthStateChanged, getAuth, signOut } from 'firebase/auth';
import { initializeApp, deleteApp } from 'firebase/app';
import { doc, setDoc, getDocs, collection, query, where, deleteDoc, updateDoc, getDoc } from 'firebase/firestore';
import { getAllBranches } from '../../services/branch-service.js';

let editingUserId = null;
let currentUserId = null;
let currentBusinessId = null;
let allUsers = [];
let allBusinesses = [];
let allBranches = [];

document.addEventListener('DOMContentLoaded', () => {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      showToast('אין לך הרשאה לגשת לדף זה', 'error');
      window.location.href = '/login.html';
      return;
    }

    try {
      // Get user data from Firestore
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.data();
      currentUserId = user.uid;
      
      if (!userData || (userData.role !== 'admin' && userData.role !== 'superAdmin')) {
        showToast('אין לך הרשאה לגשת לדף זה', 'error');
        window.location.href = '/manager/dashboard.html';
        return;
      }

      currentBusinessId = userData.businessId;
      createNavbar();
      await Promise.all([
        loadUsers(),
        loadBranches()
      ]);
      
      // Load businesses if superAdmin
      if (userData.role === 'superAdmin') {
        await loadBusinesses();
        document.getElementById('allowedBusinessesContainer').style.display = 'block';
      }

      // Event listeners
      document.getElementById('addUserBtn').addEventListener('click', () => openModal());
      document.getElementById('closeModal').addEventListener('click', closeModal);
      document.getElementById('cancelBtn').addEventListener('click', closeModal);
      document.getElementById('userForm').addEventListener('submit', handleSubmit);
      document.getElementById('userRole').addEventListener('change', handleRoleChange);
      
    } catch (error) {
      console.error('Error initializing users page:', error);
      showToast('שגיאה בטעינת הדף', 'error');
    }
  });
});

/**
 * Load all branches for the business
 */
async function loadBranches() {
  try {
    allBranches = await getAllBranches(currentBusinessId);
  } catch (error) {
    console.error('Error loading branches:', error);
  }
}

/**
 * Handle role change
 */
function handleRoleChange(e) {
  const role = e.target.value;
  const branchesContainer = document.getElementById('allowedBranchesContainer');
  
  if (role === 'branchManager') {
    branchesContainer.style.display = 'block';
  } else {
    branchesContainer.style.display = 'none';
  }
}

/**
 * Render branches checkbox list
 */
function renderBranchesList(allowedIds = []) {
  const container = document.getElementById('branchesList');
  
  if (allBranches.length === 0) {
    container.innerHTML = '<p class="text-muted">לא נמצאו סניפים</p>';
    return;
  }
  
  container.innerHTML = allBranches.map(branch => {
    const isChecked = allowedIds.includes(branch.id);
    
    return `
    <div class="checkbox-item">
      <input type="checkbox" id="branch_${branch.id}" value="${branch.id}" 
             ${isChecked ? 'checked' : ''}>
      <label for="branch_${branch.id}">${branch.name}</label>
    </div>
  `}).join('');
}

/**
 * Load all businesses (for superAdmin)
 */
async function loadBusinesses() {
  try {
    console.log('Loading businesses...');
    const snapshot = await getDocs(collection(db, 'businesses'));
    allBusinesses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log(`Loaded ${allBusinesses.length} businesses`);
  } catch (error) {
    console.error('Error loading businesses:', error);
    showToast('שגיאה בטעינת רשימת עסקים: ' + error.message, 'error');
  }
}

/**
 * Render businesses checkbox list
 */
function renderBusinessesList(allowedIds = []) {
  const container = document.getElementById('businessesList');
  
  if (allBusinesses.length === 0) {
    container.innerHTML = '<p class="text-muted">לא נמצאו עסקים או שגיאה בטעינה</p>';
    return;
  }
  
  // If creating new user (allowedIds empty), current business is checked & disabled
  // If editing (allowedIds has values), check those values. Current business always checked & disabled.
  
  container.innerHTML = allBusinesses.map(business => {
    const isCurrentBusiness = business.id === currentBusinessId;
    const isChecked = isCurrentBusiness || allowedIds.includes(business.id);
    
    return `
    <div class="checkbox-item">
      <input type="checkbox" id="business_${business.id}" value="${business.id}" 
             ${isChecked ? 'checked' : ''} 
             ${isCurrentBusiness ? 'disabled' : ''}>
      <label for="business_${business.id}">${business.name}</label>
    </div>
  `}).join('');
}

/**
 * Load all users for the business
 */
async function loadUsers() {
  try {
    const q = query(
      collection(db, 'users'),
      where('businessId', '==', currentBusinessId)
    );
    
    const snapshot = await getDocs(q);
    allUsers = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(u => u.role !== 'superAdmin' && u.isActive !== false); // Don't show superAdmin and inactive users
    
    renderUsers();
  } catch (error) {
    console.error('Error loading users:', error);
    showToast('שגיאה בטעינת משתמשים', 'error');
  }
}

/**
 * Render users grid
 */
function renderUsers() {
  const grid = document.getElementById('usersGrid');
  const emptyState = document.getElementById('emptyState');
  
  if (allUsers.length === 0) {
    grid.style.display = 'none';
    emptyState.style.display = 'block';
    return;
  }
  
  grid.style.display = 'grid';
  emptyState.style.display = 'none';
  
  grid.innerHTML = allUsers.map(user => `
    <div class="user-card">
      <div class="user-card-header">
        <div class="user-info">
          <i class="fas fa-user-circle"></i>
          <div>
            <h3>${user.displayName || user.email}</h3>
            <span class="user-email">${user.email}</span>
          </div>
        </div>
        <span class="role-badge ${user.role}">
          ${user.role === 'admin' ? 'מנהל' : (user.role === 'branchManager' ? 'מנהל סניף' : 'מורה')}
        </span>
      </div>
      <div class="user-card-actions">
        ${user.id !== currentUserId ? `
          <button class="btn btn-sm btn-secondary" onclick="editUser('${user.id}')">
            <i class="fas fa-edit"></i> ערוך
          </button>
          <button class="btn btn-sm btn-danger" onclick="deleteUser('${user.id}', '${user.email}')">
            <i class="fas fa-trash"></i> מחק
          </button>
        ` : `
          <span class="text-muted" style="font-size: 12px;">משתמש נוכחי</span>
        `}
      </div>
    </div>
  `).join('');
}

/**
 * Open modal
 */
function openModal(user = null) {
  const modalTitle = document.getElementById('modalTitle');
  const form = document.getElementById('userForm');
  const emailInput = document.getElementById('userEmail');
  const passwordInput = document.getElementById('userPassword');
  
  form.reset();
  
  if (user) {
    editingUserId = user.id;
    modalTitle.textContent = 'ערוך משתמש';
    emailInput.value = user.email;
    emailInput.disabled = true; // Cannot change email
    document.getElementById('userRole').value = user.role;
    document.getElementById('userName').value = user.displayName || '';
    passwordInput.placeholder = 'השאר ריק כדי לשמור על הסיסמה הקיימת';
    
    // Handle branch manager specific UI
    const branchesContainer = document.getElementById('allowedBranchesContainer');
    if (user.role === 'branchManager') {
      branchesContainer.style.display = 'block';
      renderBranchesList(user.allowedBranchIds || []);
    } else {
      branchesContainer.style.display = 'none';
      renderBranchesList([]); // Reset
    }

    // Render businesses with user's allowed businesses checked
    renderBusinessesList(user.allowedBusinessIds || []);
  } else {
    editingUserId = null;
    modalTitle.textContent = 'הוסף משתמש';
    emailInput.disabled = false;
    passwordInput.placeholder = 'השאר ריק ליצירה אוטומטית';
    
    // Reset UI
    document.getElementById('allowedBranchesContainer').style.display = 'none';
    renderBranchesList([]);
    
    // Render businesses with only current business checked
    renderBusinessesList([]);
  }
  
  showModal('userModal');
}

/**
 * Edit user wrapper
 */
window.editUser = function(userId) {
  const user = allUsers.find(u => u.id === userId);
  if (user) {
    openModal(user);
  }
};

/**
 * Close modal
 */
function closeModalWrapper() {
  closeModal();
}

/**
 * Handle form submit
 */
async function handleSubmit(e) {
  e.preventDefault();
  
  const email = document.getElementById('userEmail').value;
  const role = document.getElementById('userRole').value;
  const displayName = document.getElementById('userName').value || '';
  const manualPassword = document.getElementById('userPassword').value;
  
  // Get selected businesses
  const selectedBusinesses = [];
  const checkboxes = document.querySelectorAll('#businessesList input[type="checkbox"]:checked');
  checkboxes.forEach(cb => selectedBusinesses.push(cb.value));
  
  // Ensure current business is included
  if (!selectedBusinesses.includes(currentBusinessId)) {
    selectedBusinesses.push(currentBusinessId);
  }

  // Get selected branches (only if role is branchManager)
  let selectedBranches = [];
  if (role === 'branchManager') {
    const branchCheckboxes = document.querySelectorAll('#branchesList input[type="checkbox"]:checked');
    branchCheckboxes.forEach(cb => selectedBranches.push(cb.value));
    
    if (selectedBranches.length === 0) {
      showToast('יש לבחור לפחות סניף אחד למנהל סניף', 'error');
      submitBtn.disabled = false;
      return;
    }
  }

  const submitBtn = document.querySelector('#userForm button[type="submit"]');
  const originalBtnText = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> שומר...';

  let secondaryApp = null;

  try {
    if (editingUserId) {
      // Update existing user
      const updates = {
        role,
        displayName,
        allowedBusinessIds: selectedBusinesses,
        allowedBranchIds: selectedBranches,
        updatedAt: new Date()
      };
      
      // If password provided, update it (requires cloud function or admin sdk usually, 
      // but here we might need to use the secondary app trick if we want to update auth)
      // For now, we'll just update Firestore data. Password update for other users 
      // is complex from client SDK without re-auth.
      if (manualPassword && manualPassword.length >= 6) {
        showToast('שים לב: שינוי סיסמה למשתמש אחר אינו נתמך כרגע דרך ממשק זה.', 'warning');
      }

      await updateDoc(doc(db, 'users', editingUserId), updates);
      showToast('המשתמש עודכן בהצלחה');
      
    } else {
      // Create new user
      // Use manual password or generate random one
      const password = manualPassword && manualPassword.length >= 6 
        ? manualPassword 
        : Math.random().toString(36).slice(-8) + 'A1!';

      // Create a secondary app instance to avoid logging out the current admin
      secondaryApp = initializeApp(app.options, 'Secondary');
      const secondaryAuth = getAuth(secondaryApp);

      // Create Firebase Auth user using the secondary auth instance
      const userCred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      
      // Create Firestore user document (using the main db instance where we are authenticated as admin)
      await setDoc(doc(db, 'users', userCred.user.uid), {
        email,
        role,
        displayName,
        businessId: currentBusinessId,
        allowedBusinessIds: selectedBusinesses,
        allowedBranchIds: selectedBranches,
        isActive: true,
        createdAt: new Date()
      });
      
      // Sign out from the secondary app just in case
      await signOut(secondaryAuth);

      showModal({ 
        title: 'משתמש נוצר בהצלחה', 
        content: `סיסמה: ${password}<br><br>אנא שמור סיסמה זו ושלח למשתמש`,
        confirmText: 'אישור',
        showCancel: false
      });
    }
    
    closeModal();
    await loadUsers();
  } catch (error) {
    console.error('Error saving user:', error);
    
    if (error.code === 'auth/email-already-in-use') {
      showModal({
        title: 'כתובת אימייל תפוסה',
        content: `
          <div style="text-align: center;">
            <div style="color: #f59e0b; font-size: 3rem; margin-bottom: 1rem;">
              <i class="fas fa-exclamation-triangle"></i>
            </div>
            <p style="font-size: 1.1rem; margin-bottom: 1rem;">
              הכתובת <strong>${email}</strong> כבר קיימת במערכת.
            </p>
            <div style="text-align: right; background: #f8f9fa; padding: 1rem; border-radius: 8px;">
              <strong>מה ניתן לעשות?</strong>
              <ul style="margin-top: 0.5rem; padding-right: 1.5rem;">
                <li>בדוק אם המשתמש כבר קיים ברשימה (אולי הוא לא פעיל?)</li>
                <li>השתמש בכתובת אימייל אחרת ליצירת המשתמש החדש</li>
                <li>צור קשר עם המנהל הראשי (Super Admin) כדי להוסיף את המשתמש הקיים לעסק זה</li>
              </ul>
            </div>
          </div>
        `,
        confirmText: 'הבנתי',
        showCancel: false
      });
    } else {
      showToast('שגיאה בשמירת משתמש: ' + (error.message || error), 'error');
    }
  } finally {
    if (secondaryApp) {
      try {
        await deleteApp(secondaryApp);
      } catch (e) {
        console.error('Error deleting secondary app:', e);
      }
    }
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalBtnText;
  }
}

/**
 * Delete user
 */
window.deleteUser = async function(userId, email) {
  if (!await showConfirm({ title: 'מחיקת משתמש', message: `האם למחוק את המשתמש ${email}?` })) {
    return;
  }
  
  showToast('מוחק משתמש...', 'info');
  try {
    // Note: We can't delete Firebase Auth users from client side
    // Just mark as inactive in Firestore
    await updateDoc(doc(db, 'users', userId), { isActive: false });
    
    showToast('המשתמש סומן כלא פעיל');
    await loadUsers();
  } catch (error) {
    console.error('Error deleting user:', error);
    showToast('שגיאה במחיקת משתמש', 'error');
  }
};
