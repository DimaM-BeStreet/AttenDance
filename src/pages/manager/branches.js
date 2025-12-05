/**
 * Branches Management Page
 */

import { createNavbar } from '../../components/navbar.js';
import { showModal, closeModal, showConfirm, showToast } from '../../components/modal.js';
import { auth, db } from '../../config/firebase-config.js';
import { doc, getDoc } from 'firebase/firestore';
import { 
  getAllBranches, 
  createBranch, 
  updateBranch, 
  deleteBranch,
  toggleBranchActive 
} from '../../services/branch-service.js';

let currentBusinessId = null;
let currentBranchId = null;
let allBranches = [];

/**
 * Initialize the page
 */
async function init() {
  // Initialize navbar
  await createNavbar();

  // Check authentication
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = '../login.html';
      return;
    }

    try {
      // Check user role
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.data();
      
      if (!userData || !['superAdmin', 'admin', 'branchManager'].includes(userData.role)) {
        showToast('אין לך הרשאות לצפות בדף זה', 'error');
        window.location.href = '/';
        return;
      }

      // Store user data for filtering
      window.currentUser = userData;

      // Get business ID
      currentBusinessId = await getBusinessId(user);
      
      if (currentBusinessId) {
        await loadBranches();
        setupEventListeners();
        
        // Hide Add Branch button for Branch Managers
        if (userData.role === 'branchManager') {
            document.getElementById('addBranchBtn').style.display = 'none';
        }
      } else {
        showToast('לא נמצא מזהה סטודיו', 'error');
      }
    } catch (error) {
      console.error('Error checking permissions:', error);
      showToast('שגיאה בבדיקת הרשאות', 'error');
      window.location.href = '/';
    }
  });
}

/**
 * Get business ID for user
 */
async function getBusinessId(user) {
  try {
    const token = await user.getIdTokenResult();
    return token.claims.businessId || 'demo-business-001';
  } catch (error) {
    console.error('Error getting business ID:', error);
    return 'demo-business-001';
  }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Add branch button
  document.getElementById('addBranchBtn').addEventListener('click', openAddBranchModal);

  // Form submission
  document.getElementById('branchForm').addEventListener('submit', handleFormSubmit);
  
  // Toggle and delete buttons in modal
  document.getElementById('toggleBranchBtn').addEventListener('click', handleToggleBranch);
  document.getElementById('deleteBranchBtn').addEventListener('click', handleDeleteBranch);
}

/**
 * Load branches from database
 */
async function loadBranches() {
  try {
    allBranches = await getAllBranches(currentBusinessId);
    
    // Filter for Branch Manager
    if (window.currentUser && window.currentUser.role === 'branchManager') {
        const allowedIds = window.currentUser.allowedBranchIds || [];
        allBranches = allBranches.filter(b => allowedIds.includes(b.id));
    }
    
    renderBranches(allBranches);
  } catch (error) {
    console.error('Error loading branches:', error);
    showToast('שגיאה בטעינת הסניפים', 'error');
  }
}

/**
 * Render branches grid
 */
function renderBranches(branches) {
  const grid = document.getElementById('branchesGrid');
  const emptyState = document.getElementById('emptyState');

  if (branches.length === 0) {
    grid.style.display = 'none';
    emptyState.style.display = 'flex';
    return;
  }

  grid.style.display = 'grid';
  emptyState.style.display = 'none';

  grid.innerHTML = branches.map(branch => `
    <div class="branch-card ${!branch.isActive ? 'inactive' : ''}">
      <div class="branch-header">
        <h3>${branch.name}</h3>
        <span class="branch-status ${branch.isActive ? 'active' : 'inactive'}">
          ${branch.isActive ? 'פעיל' : 'לא פעיל'}
        </span>
      </div>
      <div class="branch-info">
        <div class="branch-info-item">
          <i class="fas fa-city"></i>
          <span>${branch.city}</span>
        </div>
        <div class="branch-info-item">
          <i class="fas fa-map-marker-alt"></i>
          <span>${branch.address}</span>
        </div>
        <div class="branch-info-item">
          <i class="fas fa-phone"></i>
          <span>${branch.phone}</span>
        </div>
        <div class="branch-info-item">
          <i class="fas fa-envelope"></i>
          <span>${branch.branchEmail}</span>
        </div>
        <div class="branch-info-item">
          <i class="fas fa-user-tie"></i>
          <span>${branch.managerEmail}</span>
        </div>
      </div>
      <div class="branch-actions">
        <button class="btn-icon btn-edit" onclick="window.editBranch('${branch.id}')" title="ערוך">
          <i class="fas fa-edit"></i> ערוך
        </button>
      </div>
    </div>
  `).join('');
}

/**
 * Open add branch modal
 */
function openAddBranchModal() {
  currentBranchId = null;
  document.getElementById('modalTitle').textContent = 'הוסף סניף';
  document.getElementById('branchForm').reset();
  document.getElementById('branchActive').checked = true;
  
  // Hide toggle and delete buttons for new branch
  document.getElementById('toggleBranchBtn').style.display = 'none';
  document.getElementById('deleteBranchBtn').style.display = 'none';
  
  openBranchModal();
}

/**
 * Open edit branch modal
 */
async function editBranch(branchId) {
  currentBranchId = branchId;
  const branch = allBranches.find(b => b.id === branchId);

  if (!branch) {
    showToast('סניף לא נמצא', 'error');
    return;
  }

  document.getElementById('modalTitle').textContent = 'ערוך סניף';
  document.getElementById('branchName').value = branch.name;
  document.getElementById('branchShortName').value = branch.shortName || '';
  document.getElementById('branchCity').value = branch.city;
  document.getElementById('branchAddress').value = branch.address;
  document.getElementById('branchPhone').value = branch.phone;
  document.getElementById('branchEmail').value = branch.branchEmail;
  document.getElementById('branchManagerEmail').value = branch.managerEmail;
  document.getElementById('branchActive').checked = branch.isActive;
  
  // Show and configure toggle and delete buttons for existing branch
  const toggleBtn = document.getElementById('toggleBranchBtn');
  const toggleText = document.getElementById('toggleBranchText');
  toggleBtn.style.display = 'inline-block';
  toggleText.textContent = branch.isActive ? 'השבת' : 'הפעל';
  
  document.getElementById('deleteBranchBtn').style.display = 'inline-block';

  openBranchModal();
}

/**
 * Handle form submission
 */
async function handleFormSubmit(e) {
  e.preventDefault();

  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> שומר...';

  const shortName = document.getElementById('branchShortName').value.trim();
  if (!shortName || shortName.length < 2 || shortName.length > 4) {
    showToast('יש להזין קיצור שם בין 2 ל-4 תווים', 'error');
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;
    return;
  }

  const branchData = {
    name: document.getElementById('branchName').value.trim(),
    shortName,
    city: document.getElementById('branchCity').value.trim(),
    address: document.getElementById('branchAddress').value.trim(),
    phone: document.getElementById('branchPhone').value.trim(),
    branchEmail: document.getElementById('branchEmail').value.trim(),
    managerEmail: document.getElementById('branchManagerEmail').value.trim(),
    isActive: document.getElementById('branchActive').checked
  };

  try {
    if (currentBranchId) {
      // Update existing branch
      await updateBranch(currentBusinessId, currentBranchId, branchData);
      showToast('הסניף עודכן בהצלחה');
    } else {
      // Create new branch
      await createBranch(currentBusinessId, branchData);
      showToast('הסניף נוסף בהצלחה');
    }

    closeBranchModal();
    await loadBranches();
  } catch (error) {
    console.error('Error saving branch:', error);
    showToast('שגיאה בשמירת הסניף: ' + error.message, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;
  }
}

/**
 * Handle toggle branch button click
 */
async function handleToggleBranch() {
  if (!currentBranchId) return;
  
  try {
    await toggleBranchActive(currentBusinessId, currentBranchId);
    closeBranchModal();
    await loadBranches();
  } catch (error) {
    console.error('Error toggling branch:', error);
    showToast('שגיאה בשינוי סטטוס הסניף', 'error');
  }
}

/**
 * Toggle branch active status
 */
async function toggleBranch(branchId) {
  try {
    await toggleBranchActive(currentBusinessId, branchId);
    await loadBranches();
  } catch (error) {
    console.error('Error toggling branch:', error);
    showToast('שגיאה בשינוי סטטוס הסניף', 'error');
  }
}

/**
 * Handle delete branch button click
 */
async function handleDeleteBranch() {
  if (!currentBranchId) return;
  
  const branch = allBranches.find(b => b.id === currentBranchId);
  
  if (!branch) {
    showToast('סניף לא נמצא', 'error');
    return;
  }

  if (await showConfirm({ title: 'מחיקת סניף', message: `האם אתה בטוח שברצונך למחוק את הסניף "${branch.name}"?\n\nמחיקת סניף תשפיע על כל המיקומים, קורסים ותבניות המשויכים אליו.` })) {
    const deleteBtn = document.getElementById('deleteBranchBtn');
    const originalText = deleteBtn.innerHTML;
    deleteBtn.disabled = true;
    deleteBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> מוחק...';

    try {
      await deleteBranch(currentBusinessId, currentBranchId);
      showToast('הסניף נמחק בהצלחה');
      closeBranchModal();
      await loadBranches();
    } catch (error) {
      console.error('Error deleting branch:', error);
      showToast('שגיאה במחיקת הסניף: ' + error.message, 'error');
    } finally {
      if (deleteBtn) {
        deleteBtn.disabled = false;
        deleteBtn.innerHTML = originalText;
      }
    }
  }
}

/**
 * Delete branch with confirmation
 */
async function deleteBranchConfirm(branchId) {
  const branch = allBranches.find(b => b.id === branchId);
  
  if (!branch) {
    showToast('סניף לא נמצא', 'error');
    return;
  }

  if (await showConfirm({ title: 'מחיקת סניף', message: `האם אתה בטוח שברצונך למחוק את הסניף "${branch.name}"?\n\nמחיקת סניף תשפיע על כל המיקומים, קורסים ותבניות המשויכים אליו.` })) {
    showToast('מוחק סניף...', 'info');
    try {
      await deleteBranch(currentBusinessId, branchId);
      showToast('הסניף נמחק בהצלחה');
      await loadBranches();
    } catch (error) {
      console.error('Error deleting branch:', error);
      showToast('שגיאה במחיקת הסניף: ' + error.message, 'error');
    }
  }
}

/**
 * Open modal
 */
function openBranchModal() {
  showModal('branchModal');
}

/**
 * Close modal
 */
function closeBranchModal() {
  closeModal();
  currentBranchId = null;
}

// Make functions available globally for onclick handlers
window.editBranch = editBranch;
window.toggleBranch = toggleBranch;
window.deleteBranchConfirm = deleteBranchConfirm;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
