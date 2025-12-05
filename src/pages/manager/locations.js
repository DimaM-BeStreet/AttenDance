/**
 * Locations Management Page
 */

import { createNavbar } from '../../components/navbar.js';
import { showModal, closeModal, showConfirm, showToast } from '../../components/modal.js';
import { auth, db } from '../../config/firebase-config.js';
import { doc, getDoc } from 'firebase/firestore';
import { 
  getAllLocations, 
  createLocation, 
  updateLocation, 
  deleteLocation,
  toggleLocationActive 
} from '../../services/location-service.js';
import { getAllBranches } from '../../services/branch-service.js';

let currentBusinessId = null;
let currentLocationId = null;
let allLocations = [];
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
      
      if (!userData || !['superAdmin', 'admin'].includes(userData.role)) {
        showToast('אין לך הרשאות לצפות בדף זה', 'error');
        window.location.href = '/';
        return;
      }

      // Get business ID from user's custom claims or settings
      currentBusinessId = await getBusinessId(user);
      
      if (currentBusinessId) {
        await loadBranches();
        await loadLocations();
        setupEventListeners();
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
  // Add location button
  document.getElementById('addLocationBtn').addEventListener('click', openAddLocationModal);

  // Form submission
  document.getElementById('locationForm').addEventListener('submit', handleFormSubmit);
  
  // Branch filter
  const branchFilter = document.getElementById('branchFilter');
  if (branchFilter) {
    branchFilter.addEventListener('change', applyBranchFilter);
  }
  
  // Toggle and delete buttons in modal
  document.getElementById('toggleLocationBtn').addEventListener('click', handleToggleLocation);
  document.getElementById('deleteLocationBtn').addEventListener('click', handleDeleteLocation);
}

/**
 * Load all branches
 */
async function loadBranches() {
  try {
    allBranches = await getAllBranches(currentBusinessId, { isActive: true });
    populateBranchDropdown();
  } catch (error) {
    console.error('Error loading branches:', error);
  }
}

/**
 * Populate branch dropdown
 */
function populateBranchDropdown() {
  const branchSelect = document.getElementById('locationBranch');
  
  // Keep the "no branch" option
  branchSelect.innerHTML = '<option value="">ללא סניף</option>';
  
  // Add branch options
  allBranches.forEach(branch => {
    const option = document.createElement('option');
    option.value = branch.id;
    option.textContent = branch.name;
    branchSelect.appendChild(option);
  });
  
  // Populate filter dropdown and show/hide based on branch count
  const filterContainer = document.getElementById('branchFilterContainer');
  const branchFilter = document.getElementById('branchFilter');
  
  if (allBranches.length > 1) {
    branchFilter.innerHTML = '<option value="">כל הסניפים</option>' + 
      allBranches.map(branch => `<option value="${branch.id}">${branch.name}</option>`).join('');
    filterContainer.style.display = 'block';
  } else {
    filterContainer.style.display = 'none';
  }
}

/**
 * Load all locations
 */
async function loadLocations() {
  try {
    allLocations = await getAllLocations(currentBusinessId);
    applyBranchFilter();
  } catch (error) {
    console.error('Error loading locations:', error);
    showToast('שגיאה בטעינת מיקומים', 'error');
  }
}

/**
 * Apply branch filter
 */
function applyBranchFilter() {
  const branchFilter = document.getElementById('branchFilter');
  const selectedBranch = branchFilter ? branchFilter.value : '';
  
  let filtered = allLocations;
  
  if (selectedBranch) {
    filtered = allLocations.filter(loc => loc.branchId === selectedBranch);
  }
  
  renderLocations(filtered);
}

/**
 * Render locations grid
 */
function renderLocations(locations) {
  const grid = document.getElementById('locationsGrid');
  const emptyState = document.getElementById('emptyState');

  if (locations.length === 0) {
    grid.style.display = 'none';
    emptyState.style.display = 'block';
    return;
  }

  grid.style.display = 'grid';
  emptyState.style.display = 'none';

  grid.innerHTML = locations.map(location => {
    const branch = location.branchId ? allBranches.find(b => b.id === location.branchId) : null;
    
    return `
    <div class="location-card ${location.isActive ? '' : 'inactive'}">
      <div class="location-card-header">
        <div class="location-card-title">
          <i class="fas fa-map-marker-alt"></i>
          <h3>${location.name}</h3>
        </div>
        <span class="location-status-badge ${location.isActive ? 'active' : 'inactive'}">
          ${location.isActive ? 'פעיל' : 'לא פעיל'}
        </span>
      </div>

      <div class="location-card-body">
        <div class="location-info">
          ${branch ? `
          <div class="location-info-item">
            <i class="fas fa-building"></i>
            <span><strong>סניף:</strong> ${branch.name}</span>
          </div>
          ` : ''}
          <div class="location-info-item">
            <i class="fas fa-users"></i>
            <span><strong>קיבולת מקסימלית:</strong> ${location.maxStudents} תלמידים</span>
          </div>
        </div>

        ${location.description ? `
          <div class="location-description">
            ${location.description}
          </div>
        ` : ''}
      </div>

      <div class="location-card-actions">
        <button class="btn-edit" onclick="window.editLocation('${location.id}')">
          <i class="fas fa-edit"></i> ערוך
        </button>
      </div>
    </div>
  `;
  }).join('');
}

/**
 * Open add location modal
 */
function openAddLocationModal() {
  currentLocationId = null;
  document.getElementById('modalTitle').textContent = 'הוסף מיקום';
  document.getElementById('locationForm').reset();
  document.getElementById('locationActive').checked = true;
  document.getElementById('locationBranch').value = '';
  
  // Hide toggle and delete buttons for new location
  document.getElementById('toggleLocationBtn').style.display = 'none';
  document.getElementById('deleteLocationBtn').style.display = 'none';
  
  openLocationModal();
}

/**
 * Open edit location modal
 */
async function editLocation(locationId) {
  currentLocationId = locationId;
  const location = allLocations.find(l => l.id === locationId);

  if (!location) {
    showToast('מיקום לא נמצא', 'error');
    return;
  }

  document.getElementById('modalTitle').textContent = 'ערוך מיקום';
  document.getElementById('locationName').value = location.name;
  document.getElementById('locationBranch').value = location.branchId || '';
  document.getElementById('locationMaxStudents').value = location.maxStudents;
  document.getElementById('locationDescription').value = location.description || '';
  document.getElementById('locationActive').checked = location.isActive;
  
  // Show and configure toggle and delete buttons for existing location
  const toggleBtn = document.getElementById('toggleLocationBtn');
  const toggleText = document.getElementById('toggleLocationText');
  toggleBtn.style.display = 'inline-block';
  toggleText.textContent = location.isActive ? 'השבת' : 'הפעל';
  
  document.getElementById('deleteLocationBtn').style.display = 'inline-block';

  openLocationModal();
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

  const branchValue = document.getElementById('locationBranch').value;
  
  const locationData = {
    name: document.getElementById('locationName').value.trim(),
    branchId: branchValue || null,
    maxStudents: parseInt(document.getElementById('locationMaxStudents').value),
    description: document.getElementById('locationDescription').value.trim(),
    isActive: document.getElementById('locationActive').checked
  };

  try {
    if (currentLocationId) {
      // Update existing location
      await updateLocation(currentBusinessId, currentLocationId, locationData);
      showToast('המיקום עודכן בהצלחה');
    } else {
      // Create new location
      await createLocation(currentBusinessId, locationData);
      showToast('המיקום נוסף בהצלחה');
    }

    closeLocationModal();
    await loadLocations();
  } catch (error) {
    console.error('Error saving location:', error);
    showToast('שגיאה בשמירת המיקום: ' + error.message, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;
  }
}

/**
 * Handle toggle location button click
 */
async function handleToggleLocation() {
  if (!currentLocationId) return;
  
  try {
    await toggleLocationActive(currentBusinessId, currentLocationId);
    closeLocationModal();
    await loadLocations();
  } catch (error) {
    console.error('Error toggling location:', error);
    showToast('שגיאה בשינוי סטטוס המיקום', 'error');
  }
}

/**
 * Toggle location active status
 */
async function toggleLocation(locationId) {
  try {
    await toggleLocationActive(currentBusinessId, locationId);
    await loadLocations();
  } catch (error) {
    console.error('Error toggling location:', error);
    showToast('שגיאה בשינוי סטטוס המיקום', 'error');
  }
}

/**
 * Handle delete location button click
 */
async function handleDeleteLocation() {
  if (!currentLocationId) return;
  
  const location = allLocations.find(l => l.id === currentLocationId);
  
  if (!location) {
    showToast('מיקום לא נמצא', 'error');
    return;
  }

  if (await showConfirm({ title: 'מחיקת מיקום', message: `האם אתה בטוח שברצונך למחוק את המיקום "${location.name}"?` })) {
    showToast('מוחק מיקום...', 'info');
    try {
      await deleteLocation(currentBusinessId, currentLocationId);
      showToast('המיקום נמחק בהצלחה');
      closeLocationModal();
      await loadLocations();
    } catch (error) {
      console.error('Error deleting location:', error);
      showToast('שגיאה במחיקת המיקום: ' + error.message, 'error');
    }
  }
}

/**
 * Delete location with confirmation
 */
async function deleteLocationConfirm(locationId) {
  const location = allLocations.find(l => l.id === locationId);
  
  if (!location) {
    showToast('מיקום לא נמצא', 'error');
    return;
  }

  if (await showConfirm({ title: 'מחיקת מיקום', message: `האם אתה בטוח שברצונך למחוק את המיקום "${location.name}"?` })) {
    showToast('מוחק מיקום...', 'info');
    try {
      await deleteLocation(currentBusinessId, locationId);
      showToast('המיקום נמחק בהצלחה');
      await loadLocations();
    } catch (error) {
      console.error('Error deleting location:', error);
      showToast('שגיאה במחיקת המיקום: ' + error.message, 'error');
    }
  }
}

/**
 * Apply filters
 */
function applyFilters() {
  const statusFilter = document.getElementById('statusFilter').value;
  const searchQuery = document.getElementById('searchInput').value.toLowerCase().trim();

  let filtered = [...allLocations];

  // Status filter
  if (statusFilter === 'active') {
    filtered = filtered.filter(l => l.isActive);
  } else if (statusFilter === 'inactive') {
    filtered = filtered.filter(l => !l.isActive);
  }

  // Search filter
  if (searchQuery) {
    filtered = filtered.filter(l => 
      l.name.toLowerCase().includes(searchQuery) ||
      (l.description && l.description.toLowerCase().includes(searchQuery))
    );
  }

  renderLocations(filtered);
}

/**
 * Reset filters
 */
function resetFilters() {
  document.getElementById('statusFilter').value = 'all';
  document.getElementById('searchInput').value = '';
  renderLocations(allLocations);
}

/**
 * Open modal
 */
function openLocationModal() {
  showModal('locationModal');
}

/**
 * Close modal
 */
function closeLocationModal() {
  closeModal();
  currentLocationId = null;
}

// Make functions available globally for onclick handlers
window.editLocation = editLocation;
window.toggleLocation = toggleLocation;
window.deleteLocationConfirm = deleteLocationConfirm;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
