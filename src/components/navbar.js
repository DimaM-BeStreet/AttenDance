// Auth service functions imported dynamically where needed

/**
 * Navbar Component
 * Role-based navigation menu for the application
 */

const MENU_ITEMS = {
  superAdmin: [
    { label: 'לוח בקרה', icon: '📊', href: '/manager/dashboard.html' },
    { label: 'תלמידים', icon: '👥', href: '/manager/students.html' },
    { label: 'מורים', icon: '👨‍🏫', href: '/manager/teachers.html' },
    { label: 'תבניות', icon: '🔄', href: '/manager/templates.html' },
    { label: 'אולמות', icon: '📍', href: '/manager/locations.html' },
    { label: 'קורסים', icon: '📚', href: '/manager/courses.html' },
    { label: 'שיעורים', icon: '📅', href: '/manager/classes.html' },
    { label: 'נוכחות', icon: '✅', href: '/manager/attendance.html' },
    { label: 'משתמשים', icon: '👤', href: '/manager/users.html' }
  ],
  admin: [
    { label: 'לוח בקרה', icon: '📊', href: '/manager/dashboard.html' },
    { label: 'תלמידים', icon: '👥', href: '/manager/students.html' },
    { label: 'מורים', icon: '👨‍🏫', href: '/manager/teachers.html' },
    { label: 'תבניות', icon: '🔄', href: '/manager/templates.html' },
    { label: 'אולמות', icon: '📍', href: '/manager/locations.html' },
    { label: 'קורסים', icon: '📚', href: '/manager/courses.html' },
    { label: 'שיעורים', icon: '📅', href: '/manager/classes.html' },
    { label: 'נוכחות', icon: '✅', href: '/manager/attendance.html' }
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
        <a href="/manager/dashboard.html" class="brand-link">
          <span class="brand-icon">💃</span>
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
            const brandIcon = document.querySelector('.brand-icon');
            if (brandIcon) {
              brandIcon.innerHTML = `<img src="${businessDoc.data().logoUrl}" alt="Logo" class="brand-logo-img">`;
            }
          }
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
