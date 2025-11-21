/**
 * Locations Management Page
 */

import { createNavbar } from '../../components/navbar.js';
import { auth, db } from '../../config/firebase-config.js';
import { doc, getDoc } from 'firebase/firestore';
import { 
  getAllLocations, 
  createLocation, 
  updateLocation, 
  deleteLocation,
  toggleLocationActive 
} from '../../services/location-service.js';

let currentStudioId = null;
let currentLocationId = null;
let allLocations = [];

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
        alert('אין לך הרשאות לצפות בדף זה');
        window.location.href = '/';
        return;
      }

      // Get studio ID from user's custom claims or settings
      currentStudioId = await getStudioId(user);
      
      if (currentStudioId) {
        await loadLocations();
        setupEventListeners();
      } else {
        alert('לא נמצא מזהה סטודיו');
      }
    } catch (error) {
      console.error('Error checking permissions:', error);
      alert('שגיאה בבדיקת הרשאות');
      window.location.href = '/';
    }
  });
}

/**
 * Get studio ID for user
 */
async function getStudioId(user) {
  try {
    const token = await user.getIdTokenResult();
    return token.claims.businessId || 'demo-studio-001';
  } catch (error) {
    console.error('Error getting studio ID:', error);
    return 'demo-studio-001';
  }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Add location button
  document.getElementById('addLocationBtn').addEventListener('click', openAddLocationModal);

  // Modal close buttons
  const modal = document.getElementById('locationModal');
  const closeBtn = modal.querySelector('.close');
  const cancelBtn = document.getElementById('cancelBtn');

  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);

  // Click outside modal to close
  window.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  // Form submission
  document.getElementById('locationForm').addEventListener('submit', handleFormSubmit);
}

/**
 * Load all locations
 */
async function loadLocations() {
  try {
    allLocations = await getAllLocations(currentStudioId);
    renderLocations(allLocations);
  } catch (error) {
    console.error('Error loading locations:', error);
    alert('שגיאה בטעינת מיקומים');
  }
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

  grid.innerHTML = locations.map(location => `
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
        <button class="btn-toggle" onclick="window.toggleLocation('${location.id}')">
          <i class="fas fa-power-off"></i> ${location.isActive ? 'השבת' : 'הפעל'}
        </button>
        <button class="btn-delete" onclick="window.deleteLocationConfirm('${location.id}')">
          <i class="fas fa-trash"></i> מחק
        </button>
      </div>
    </div>
  `).join('');
}

/**
 * Open add location modal
 */
function openAddLocationModal() {
  currentLocationId = null;
  document.getElementById('modalTitle').textContent = 'הוסף מיקום';
  document.getElementById('locationForm').reset();
  document.getElementById('locationActive').checked = true;
  openModal();
}

/**
 * Open edit location modal
 */
async function editLocation(locationId) {
  currentLocationId = locationId;
  const location = allLocations.find(l => l.id === locationId);

  if (!location) {
    alert('מיקום לא נמצא');
    return;
  }

  document.getElementById('modalTitle').textContent = 'ערוך מיקום';
  document.getElementById('locationName').value = location.name;
  document.getElementById('locationMaxStudents').value = location.maxStudents;
  document.getElementById('locationDescription').value = location.description || '';
  document.getElementById('locationActive').checked = location.isActive;

  openModal();
}

/**
 * Handle form submission
 */
async function handleFormSubmit(e) {
  e.preventDefault();

  const locationData = {
    name: document.getElementById('locationName').value.trim(),
    maxStudents: parseInt(document.getElementById('locationMaxStudents').value),
    description: document.getElementById('locationDescription').value.trim(),
    isActive: document.getElementById('locationActive').checked
  };

  try {
    if (currentLocationId) {
      // Update existing location
      await updateLocation(currentStudioId, currentLocationId, locationData);
      alert('המיקום עודכן בהצלחה');
    } else {
      // Create new location
      await createLocation(currentStudioId, locationData);
      alert('המיקום נוסף בהצלחה');
    }

    closeModal();
    await loadLocations();
  } catch (error) {
    console.error('Error saving location:', error);
    alert('שגיאה בשמירת המיקום: ' + error.message);
  }
}

/**
 * Toggle location active status
 */
async function toggleLocation(locationId) {
  try {
    await toggleLocationActive(currentStudioId, locationId);
    await loadLocations();
  } catch (error) {
    console.error('Error toggling location:', error);
    alert('שגיאה בשינוי סטטוס המיקום');
  }
}

/**
 * Delete location with confirmation
 */
async function deleteLocationConfirm(locationId) {
  const location = allLocations.find(l => l.id === locationId);
  
  if (!location) {
    alert('מיקום לא נמצא');
    return;
  }

  if (confirm(`האם אתה בטוח שברצונך למחוק את המיקום "${location.name}"?`)) {
    try {
      await deleteLocation(currentStudioId, locationId);
      alert('המיקום נמחק בהצלחה');
      await loadLocations();
    } catch (error) {
      console.error('Error deleting location:', error);
      alert('שגיאה במחיקת המיקום: ' + error.message);
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
function openModal() {
  document.getElementById('locationModal').classList.add('show');
}

/**
 * Close modal
 */
function closeModal() {
  document.getElementById('locationModal').classList.remove('show');
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
