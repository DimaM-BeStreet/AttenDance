/**
 * Users Management Page
 * For superAdmin only - manage admin and teacher accounts
 */

import { auth, db } from '../../config/firebase-config.js';
import { createNavbar } from '../../components/navbar.js';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDocs, collection, query, where, deleteDoc, updateDoc } from 'firebase/firestore';
import { getCurrentUser } from '../../services/auth-service.js';

let currentStudioId = null;
let allUsers = [];

document.addEventListener('DOMContentLoaded', async () => {
  // Check if user is superAdmin
  const user = await getCurrentUser();
  if (!user || user.role !== 'superAdmin') {
    alert('אין לך הרשאה לגשת לדף זה');
    window.location.href = '/manager/dashboard.html';
    return;
  }

  currentStudioId = user.studioId;
  createNavbar();
  await loadUsers();

  // Event listeners
  document.getElementById('addUserBtn').addEventListener('click', () => openModal());
  document.getElementById('closeModal').addEventListener('click', closeModal);
  document.getElementById('cancelBtn').addEventListener('click', closeModal);
  document.getElementById('userForm').addEventListener('submit', handleSubmit);
});

/**
 * Load all users for the studio
 */
async function loadUsers() {
  try {
    const q = query(
      collection(db, 'users'),
      where('studioId', '==', currentStudioId)
    );
    
    const snapshot = await getDocs(q);
    allUsers = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(u => u.role !== 'superAdmin'); // Don't show superAdmin
    
    renderUsers();
  } catch (error) {
    console.error('Error loading users:', error);
    alert('שגיאה בטעינת משתמשים');
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
        <span class="role-badge ${user.role}">${user.role === 'admin' ? 'מנהל' : 'מורה'}</span>
      </div>
      <div class="user-card-actions">
        <button class="btn btn-sm btn-danger" onclick="deleteUser('${user.id}', '${user.email}')">
          <i class="fas fa-trash"></i> מחק
        </button>
      </div>
    </div>
  `).join('');
}

/**
 * Open modal
 */
function openModal() {
  document.getElementById('modalTitle').textContent = 'הוסף משתמש';
  document.getElementById('userForm').reset();
  document.getElementById('userModal').style.display = 'flex';
}

/**
 * Close modal
 */
function closeModal() {
  document.getElementById('userModal').style.display = 'none';
}

/**
 * Handle form submit
 */
async function handleSubmit(e) {
  e.preventDefault();
  
  const email = document.getElementById('userEmail').value;
  const role = document.getElementById('userRole').value;
  const displayName = document.getElementById('userName').value || '';
  
  // Generate random password
  const tempPassword = Math.random().toString(36).slice(-8) + 'A1!';
  
  try {
    // Create Firebase Auth user
    const userCred = await createUserWithEmailAndPassword(auth, email, tempPassword);
    
    // Create Firestore user document
    await setDoc(doc(db, 'users', userCred.user.uid), {
      email,
      role,
      displayName,
      studioId: currentStudioId,
      active: true,
      createdAt: new Date()
    });
    
    alert(`משתמש נוצר בהצלחה!\nסיסמה זמנית: ${tempPassword}\n\nאנא שמור סיסמה זו ושלח למשתמש`);
    
    closeModal();
    await loadUsers();
  } catch (error) {
    console.error('Error creating user:', error);
    alert('שגיאה ביצירת משתמש: ' + (error.message || error));
  }
}

/**
 * Delete user
 */
window.deleteUser = async function(userId, email) {
  if (!confirm(`האם למחוק את המשתמש ${email}?`)) {
    return;
  }
  
  try {
    // Note: We can't delete Firebase Auth users from client side
    // Just mark as inactive in Firestore
    await updateDoc(doc(db, 'users', userId), { active: false });
    
    alert('המשתמש סומן כלא פעיל');
    await loadUsers();
  } catch (error) {
    console.error('Error deleting user:', error);
    alert('שגיאה במחיקת משתמש');
  }
};
