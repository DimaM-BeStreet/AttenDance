import { getUserData } from '@services/auth-service';

/**
 * Navbar Component
 * Role-based navigation menu for the application
 */

const MENU_ITEMS = {
  superAdmin: [
    { label: 'לוח בקרה', icon: '📊', href: '/manager/dashboard.html' },
    { label: 'תלמידים', icon: '👥', href: '/manager/students.html' },
    { label: 'מורים', icon: '👨‍🏫', href: '/manager/teachers.html' },
    { label: 'שיעורים', icon: '📅', href: '/manager/classes.html' },
    { label: 'נוכחות', icon: '✅', href: '/manager/attendance.html' }
  ],
  manager: [
    { label: 'לוח בקרה', icon: '📊', href: '/manager/dashboard.html' },
    { label: 'תלמידים', icon: '👥', href: '/manager/students.html' },
    { label: 'מורים', icon: '👨‍🏫', href: '/manager/teachers.html' },
    { label: 'שיעורים', icon: '📅', href: '/manager/classes.html' },
    { label: 'נוכחות', icon: '✅', href: '/manager/attendance.html' }
  ],
  teacher: [
    { label: 'לוח בקרה', icon: '📊', href: '/manager/dashboard.html' },
    { label: 'שיעורים', icon: '📅', href: '/manager/classes.html' },
    { label: 'נוכחות', icon: '✅', href: '/manager/attendance.html' }
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
        <a href="/" class="brand-link">
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
          <div class="dropdown-item" id="user-profile">
            <span class="dropdown-icon">👤</span>
            <span>פרופיל</span>
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
  
  // Load menu items based on user role
  loadMenuItems();
  
  // Setup event listeners
  setupNavbarEvents();
}

/**
 * Load menu items based on user role
 */
async function loadMenuItems() {
  try {
    const userData = await getUserData();
    if (!userData) {
      return;
    }

    const menuContainer = document.getElementById('navbar-menu');
    const userNameDisplay = document.getElementById('user-name-display');
    
    // Set user name
    if (userNameDisplay) {
      userNameDisplay.textContent = userData.displayName || userData.email;
    }

    // Get menu items for role
    const menuItems = MENU_ITEMS[userData.role] || [];
    
    // Render menu items
    menuContainer.innerHTML = menuItems.map(item => `
      <a href="${item.href}" class="menu-item">
        <span class="menu-icon">${item.icon}</span>
        <span class="menu-label">${item.label}</span>
      </a>
    `).join('');

    // Highlight active page
    highlightActivePage();
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

  // Logout button
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      const { logout } = await import('@services/auth-service');
      await logout();
    });
  }

  // Profile button
  const userProfile = document.getElementById('user-profile');
  if (userProfile) {
    userProfile.addEventListener('click', () => {
      window.location.href = '/profile.html';
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
