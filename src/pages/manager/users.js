/**
 * Users Management Page
 * For superAdmin only - manage admin and teacher accounts
 */

import { auth, db } from '../../config/firebase-config.js';
import { createNavbar } from '../../components/navbar.js';
import { createUserWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, getDocs, collection, query, where, deleteDoc, updateDoc, getDoc } from 'firebase/firestore';

let currentBusinessId = null;
let currentUserId = null;
let allUsers = [];

document.addEventListener('DOMContentLoaded', () => {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      alert('אין לך הרשאה לגשת לדף זה');
      window.location.href = '/login.html';
      return;
    }

    try {
      // Get user data from Firestore
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.data();
      currentUserId = user.uid;
      
      if (!userData || (userData.role !== 'admin' && userData.role !== 'superAdmin')) {
        alert('אין לך הרשאה לגשת לדף זה');
        window.location.href = '/manager/dashboard.html';
        return;
      }

      currentBusinessId = userData.businessId;
      createNavbar();
      await loadUsers();

      // Event listeners
      document.getElementById('addUserBtn').addEventListener('click', () => openModal());
      document.getElementById('closeModal').addEventListener('click', closeModal);
      document.getElementById('cancelBtn').addEventListener('click', closeModal);
      document.getElementById('userForm').addEventListener('submit', handleSubmit);
      
    } catch (error) {
      console.error('Error initializing users page:', error);
      alert('שגיאה בטעינת הדף');
    }
  });
});

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
        ${user.id !== currentUserId ? `
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
      businessId: currentBusinessId,
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
