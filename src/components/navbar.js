// Auth service functions imported dynamically where needed
import { showModal, closeModal, showToast } from './modal.js';

/**
 * Navbar Component
 * Role-based navigation menu for the application
 */

const MENU_ITEMS = {
  superAdmin: [
    { label: 'לוח בקרה', icon: '📊', href: '/manager/dashboard.html' },
    { label: 'תלמידים', icon: '👥', href: '/manager/students.html' },
    { label: 'מורים', icon: '👨‍🏫', href: '/manager/teachers.html' },
    { label: 'סניפים', icon: '🏢', href: '/manager/branches.html' },
    { label: 'תבניות', icon: '🔄', href: '/manager/templates.html' },
    { label: 'אולמות', icon: '📍', href: '/manager/locations.html' },
    { label: 'קורסים', icon: '📚', href: '/manager/courses.html' },
    { label: 'שיעורים', icon: '📅', href: '/manager/classes.html' },
    { label: 'נוכחות', icon: '✅', href: '/manager/attendance.html' },
    { label: 'דוחות', icon: '📈', href: '/manager/reports.html' },
    { label: 'משתמשים', icon: '👤', href: '/manager/users.html' }
  ],
  admin: [
    { label: 'לוח בקרה', icon: '📊', href: '/manager/dashboard.html' },
    { label: 'תלמידים', icon: '👥', href: '/manager/students.html' },
    { label: 'מורים', icon: '👨‍🏫', href: '/manager/teachers.html' },
    { label: 'סניפים', icon: '🏢', href: '/manager/branches.html' },
    { label: 'תבניות', icon: '🔄', href: '/manager/templates.html' },
    { label: 'אולמות', icon: '📍', href: '/manager/locations.html' },
    { label: 'קורסים', icon: '📚', href: '/manager/courses.html' },
    { label: 'שיעורים', icon: '📅', href: '/manager/classes.html' },
    { label: 'נוכחות', icon: '✅', href: '/manager/attendance.html' },
    { label: 'דוחות', icon: '📈', href: '/manager/reports.html' }
  ],
  teacher: [
    { label: 'שיעורים שלי', icon: '📅', href: '/teacher/classes.html' },
    { label: 'נוכחות', icon: '✅', href: '/teacher/attendance.html' }
  ]
};

/**
 * Create and render navbar
 */
export function createNavbar(containerId = 'navbar-container') {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error('Navbar container not found');
    return;
  }

  const navbar = document.createElement('nav');
  navbar.className = 'navbar';
  navbar.innerHTML = `
    <div class="navbar-container">
      <div class="navbar-brand">
        <a href="/manager/dashboard.html" class="brand">
          <img src="/assets/icons/AttenDance_Logo.png" alt="AttenDance" class="brand-logo">
          <span class="brand-name">AttenDance</span>
        </a>
      </div>
      <div class="navbar-menu" id="navbar-menu">
        <!-- Menu items will be inserted here -->
      </div>
      <div class="navbar-user">
        <button class="user-menu-toggle" id="user-menu-toggle">
          <span class="user-name" id="user-name-display"></span>
          <span class="user-avatar" id="user-avatar">👤</span>
        </button>
        <div class="user-dropdown" id="user-dropdown">
          <div class="dropdown-item" id="settings-btn">
            <span class="dropdown-icon">⚙️</span>
            <span>הגדרות</span>
          </div>
          <div class="dropdown-item" id="logout-btn">
            <span class="dropdown-icon">🚪</span>
            <span>התנתק</span>
          </div>
        </div>
      </div>
      <button class="mobile-menu-toggle" id="mobile-menu-toggle">
        <span class="hamburger"></span>
      </button>
    </div>
  `;

  // Add Business Switcher Modal
  const modal = document.createElement('div');
  modal.id = 'business-switcher-modal';
  modal.className = 'modal';
  modal.style.display = 'none';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 500px;">
      <div class="modal-header">
        <h2>החלף עסק</h2>
        <span class="modal-close" id="close-business-switcher">&times;</span>
      </div>
      <div class="modal-body">
        <div class="search-container" style="margin-bottom: 15px;">
          <input type="text" id="business-search" placeholder="חפש עסק..." style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
        </div>
        <div id="business-list-container" style="max-height: 300px; overflow-y: auto;">
          <div style="text-align: center; padding: 20px;">טוען עסקים...</div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  container.appendChild(navbar);
  
  // Setup event listeners first
  setupNavbarEvents();
  
  // Load menu items based on user role (async)
  loadMenuItems().catch(err => {
    console.error('Failed to load menu items:', err);
  });
}

/**
 * Load menu items based on user role
 */
async function loadMenuItems() {
  try {
    // Import Firebase modules
    const { auth } = await import('../config/firebase-config.js');
    const { onAuthStateChanged } = await import('firebase/auth');
    const { doc, getDoc } = await import('firebase/firestore');
    const { db } = await import('../config/firebase-config.js');
    
    return new Promise((resolve) => {
      onAuthStateChanged(auth, async (user) => {
        if (!user) {
          console.error('No user logged in');
          resolve();
          return;
        }

        // Anonymous users (teachers) don't have user documents
        if (user.isAnonymous) {
          resolve();
          return;
        }

        // Get user data directly from Firestore
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (!userDoc.exists()) {
          console.error('User document not found');
          resolve();
          return;
        }
        
        const userData = userDoc.data();

        const menuContainer = document.getElementById('navbar-menu');
        if (!menuContainer) {
          console.error('Menu container not found');
          resolve();
          return;
        }
        
        const userNameDisplay = document.getElementById('user-name-display');
        
        // Set user name
        if (userNameDisplay) {
          userNameDisplay.textContent = userData.displayName || user.email;
        }
        
        // Load and display business logo if available
        if (userData.businessId) {
          const businessDocRef = doc(db, 'businesses', userData.businessId);
          const businessDoc = await getDoc(businessDocRef);
          
          if (businessDoc.exists() && businessDoc.data().logoUrl) {
            const brandLogo = document.querySelector('.brand-logo');
            if (brandLogo) {
              brandLogo.src = businessDoc.data().logoUrl;
            }
          }
        }

        // Handle Business Switching
        const allowedBusinessIds = userData.allowedBusinessIds || [];
        // Ensure current business is in the list
        if (userData.businessId && !allowedBusinessIds.includes(userData.businessId)) {
          allowedBusinessIds.push(userData.businessId);
        }

        if (allowedBusinessIds.length > 1) {
          const userDropdown = document.getElementById('user-dropdown');
          const settingsBtn = document.getElementById('settings-btn');
          
          // Add "Switch Business" button
          const switchBtn = document.createElement('div');
          switchBtn.className = 'dropdown-item';
          switchBtn.id = 'switch-business-btn';
          switchBtn.innerHTML = `
            <span class="dropdown-icon">🏢</span>
            <span>החלף עסק</span>
          `;
          
          switchBtn.addEventListener('click', () => {
            openBusinessSwitcherModal(allowedBusinessIds, userData.businessId, userDocRef);
          });
          
          userDropdown.insertBefore(switchBtn, settingsBtn);
          
          // Add separator
          const separator = document.createElement('div');
          separator.style.borderBottom = '1px solid #eee';
          separator.style.margin = '5px 0';
          userDropdown.insertBefore(separator, settingsBtn);
        }

        // Get menu items for role
        const menuItems = MENU_ITEMS[userData.role] || [];
        
        if (menuItems.length === 0) {
          console.warn('No menu items for role:', userData.role);
        }
        
        // Render menu items
        menuContainer.innerHTML = menuItems.map(item => `
          <a href="${item.href}" class="menu-item">
            <span class="menu-icon">${item.icon}</span>
            <span class="menu-label">${item.label}</span>
          </a>
        `).join('');

        // Highlight active page
        highlightActivePage();
        resolve();
      });
    });
  } catch (error) {
    console.error('Error loading menu items:', error);
  }
}

/**
 * Highlight active menu item
 */
function highlightActivePage() {
  const currentPath = window.location.pathname;
  const menuItems = document.querySelectorAll('.menu-item');
  
  menuItems.forEach(item => {
    if (item.getAttribute('href') === currentPath) {
      item.classList.add('active');
    }
  });
}

/**
 * Setup navbar event listeners
 */
function setupNavbarEvents() {
  // User menu toggle
  const userMenuToggle = document.getElementById('user-menu-toggle');
  const userDropdown = document.getElementById('user-dropdown');
  
  if (userMenuToggle && userDropdown) {
    userMenuToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      userDropdown.classList.toggle('show');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
      userDropdown.classList.remove('show');
    });
  }

  // Mobile menu toggle
  const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
  const navbarMenu = document.getElementById('navbar-menu');
  
  if (mobileMenuToggle && navbarMenu) {
    mobileMenuToggle.addEventListener('click', () => {
      navbarMenu.classList.toggle('mobile-show');
      mobileMenuToggle.classList.toggle('active');
    });
  }

  // Settings button
  const settingsBtn = document.getElementById('settings-btn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      window.location.href = '/manager/settings.html';
    });
  }

  // Logout button
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      const { logout } = await import('@services/auth-service');
      await logout();
    });
  }
}

/**
 * Update navbar user info
 */
export function updateNavbarUser(userData) {
  const userNameDisplay = document.getElementById('user-name-display');
  if (userNameDisplay) {
    userNameDisplay.textContent = userData.displayName || userData.email;
  }
}

/**
 * Show/hide navbar (for scrolling effects)
 */
let lastScrollTop = 0;
export function initScrollBehavior() {
  window.addEventListener('scroll', () => {
    const navbar = document.querySelector('.navbar');
    if (!navbar) return;

    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    if (scrollTop > lastScrollTop && scrollTop > 100) {
      // Scrolling down
      navbar.classList.add('navbar-hidden');
    } else {
      // Scrolling up
      navbar.classList.remove('navbar-hidden');
    }
    
    lastScrollTop = scrollTop;
  });
}

/**
 * Open Business Switcher Modal
 */
async function openBusinessSwitcherModal(allowedBusinessIds, currentBusinessId, userDocRef) {
  const modal = document.getElementById('business-switcher-modal');
  const listContainer = document.getElementById('business-list-container');
  const searchInput = document.getElementById('business-search');
  
  if (!modal) return;
  
  // Use centralized modal system
  showModal('business-switcher-modal');
  
  // Load businesses
  try {
    const { collection, query, where, getDocs, documentId, updateDoc } = await import('firebase/firestore');
    const { db } = await import('../config/firebase-config.js');
    
    // Chunk the IDs if > 10
    const chunks = [];
    for (let i = 0; i < allowedBusinessIds.length; i += 10) {
      chunks.push(allowedBusinessIds.slice(i, i + 10));
    }
    
    let allBusinesses = [];
    
    for (const chunk of chunks) {
      const q = query(
        collection(db, 'businesses'),
        where(documentId(), 'in', chunk)
      );
      const snapshot = await getDocs(q);
      const chunkBusinesses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      allBusinesses = [...allBusinesses, ...chunkBusinesses];
    }
    
    // Render function
    const renderList = (filterText = '') => {
      const filtered = allBusinesses.filter(b => 
        b.name.toLowerCase().includes(filterText.toLowerCase())
      );
      
      if (filtered.length === 0) {
        listContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">לא נמצאו עסקים</div>';
        return;
      }
      
      listContainer.innerHTML = filtered.map(biz => `
        <div class="business-list-item" style="
          padding: 12px;
          border-bottom: 1px solid #eee;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background-color: ${biz.id === currentBusinessId ? '#f0f7ff' : 'white'};
        ">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 1.2em;">🏢</span>
            <span style="font-weight: ${biz.id === currentBusinessId ? 'bold' : 'normal'}">${biz.name}</span>
          </div>
          ${biz.id === currentBusinessId ? '<span style="color: var(--primary-color); font-weight: bold;">פעיל</span>' : ''}
        </div>
      `).join('');
      
      // Add click listeners
      const items = listContainer.querySelectorAll('.business-list-item');
      items.forEach((item, index) => {
        const biz = filtered[index];
        item.addEventListener('click', async () => {
          if (biz.id === currentBusinessId) return;
          
          try {
            // Show loading state
            item.style.opacity = '0.7';
            item.style.pointerEvents = 'none';
            item.innerHTML = `
              <div style="display: flex; align-items: center; gap: 10px; width: 100%;">
                <div class="spinner" style="width: 20px; height: 20px; border: 2px solid #f3f3f3; border-top: 2px solid #3498db; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                <span>מעביר לעסק "${biz.name}"...</span>
              </div>
            `;
            
            // Perform switch
            await updateDoc(userDocRef, { businessId: biz.id });
            
            // Show success state
            item.style.opacity = '1';
            item.style.backgroundColor = '#f0fdf4'; // Light green background
            item.innerHTML = `
              <div style="display: flex; align-items: center; gap: 10px; width: 100%; color: #166534;">
                <span style="font-size: 1.2em;">✅</span>
                <span style="font-weight: bold;">עברת בהצלחה ל"${biz.name}"</span>
              </div>
            `;
            
            // Wait for user to see the message before reloading
            setTimeout(() => {
              window.location.reload();
            }, 1000);
            
          } catch (err) {
            console.error('Error switching business:', err);
            showToast('שגיאה במעבר עסק', 'error');
            item.style.opacity = '1';
            item.style.pointerEvents = 'auto';
            // Restore original content
            item.innerHTML = `
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 1.2em;">🏢</span>
                <span>${biz.name}</span>
              </div>
            `;
          }
        });
        
        // Hover effect
        item.onmouseover = () => { if(biz.id !== currentBusinessId) item.style.backgroundColor = '#f9f9f9'; };
        item.onmouseout = () => { if(biz.id !== currentBusinessId) item.style.backgroundColor = 'white'; };
      });
    };
    
    // Initial render
    renderList();
    
    // Search handler
    searchInput.oninput = (e) => renderList(e.target.value);
    
  } catch (error) {
    console.error('Error loading businesses for switcher:', error);
    listContainer.innerHTML = '<div style="color: red; text-align: center; padding: 20px;">שגיאה בטעינת רשימת העסקים</div>';
  }
}
