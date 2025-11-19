import { auth, db } from '@config/firebase-config';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  sendPasswordResetEmail
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { saveUserSession, getUserSession, clearUserSession } from '@utils/storage-utils';

/**
 * Authentication Service
 * Handles user authentication, session management, and role-based access
 */

/**
 * Login with email and password
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<object>} User data with role
 */
export async function login(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Get user role from Firestore
    const userData = await getUserData(user.uid);
    
    if (!userData) {
      throw new Error('User data not found');
    }
    
    // Save session
    saveUserSession({
      uid: user.uid,
      email: user.email,
      role: userData.role,
      businessId: userData.businessId,
      displayName: userData.displayName
    });
    
    return userData;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
}

/**
 * Logout current user
 * @returns {Promise<void>}
 */
export async function logout() {
  try {
    await signOut(auth);
    clearUserSession();
  } catch (error) {
    console.error('Logout error:', error);
    throw error;
  }
}

/**
 * Get user data from Firestore
 * @param {string} userId - User ID
 * @returns {Promise<object|null>} User data or null
 */
export async function getUserData(userId) {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    
    if (!userDoc.exists()) {
      return null;
    }
    
    return {
      uid: userId,
      ...userDoc.data()
    };
  } catch (error) {
    console.error('Error getting user data:', error);
    return null;
  }
}

/**
 * Get current user from session or Firebase
 * @returns {Promise<object|null>} Current user data or null
 */
export async function getCurrentUser() {
  // Try to get from session first
  const session = getUserSession();
  if (session) {
    return session;
  }
  
  // If not in session, get from Firebase
  const user = auth.currentUser;
  if (!user) return null;
  
  return await getUserData(user.uid);
}

/**
 * Check if user is authenticated
 * @returns {boolean} True if authenticated
 */
export function isAuthenticated() {
  return auth.currentUser !== null;
}

/**
 * Get user role
 * @returns {Promise<string|null>} User role or null
 */
export async function getUserRole() {
  const user = await getCurrentUser();
  return user ? user.role : null;
}

/**
 * Check if user is super admin
 * @returns {Promise<boolean>} True if super admin
 */
export async function isSuperAdmin() {
  const role = await getUserRole();
  return role === 'superAdmin';
}

/**
 * Check if user is manager
 * @returns {Promise<boolean>} True if manager
 */
export async function isManager() {
  const role = await getUserRole();
  return role === 'manager';
}

/**
 * Check if user is teacher
 * @returns {Promise<boolean>} True if teacher
 */
export async function isTeacher() {
  const role = await getUserRole();
  return role === 'teacher';
}

/**
 * Get user's business ID
 * @returns {Promise<string|null>} Business ID or null
 */
export async function getUserBusinessId() {
  const user = await getCurrentUser();
  return user ? user.businessId : null;
}

/**
 * Redirect user based on role
 * @param {string} role - User role
 */
export function redirectByRole(role) {
  switch (role) {
    case 'superAdmin':
      window.location.href = '/pages/superadmin/dashboard.html';
      break;
    case 'manager':
      window.location.href = '/pages/manager/dashboard.html';
      break;
    case 'teacher':
      window.location.href = '/pages/teacher/my-classes.html';
      break;
    default:
      console.error('Unknown user role:', role);
      window.location.href = '/';
  }
}

/**
 * Setup auth state change listener
 * @param {Function} callback - Callback function to handle auth state changes
 * @returns {Function} Unsubscribe function
 */
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      const userData = await getUserData(user.uid);
      callback(userData);
    } else {
      callback(null);
    }
  });
}

/**
 * Send password reset email
 * @param {string} email - User email
 * @returns {Promise<void>}
 */
export async function resetPassword(email) {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    console.error('Password reset error:', error);
    throw error;
  }
}

/**
 * Require authentication (redirect to login if not authenticated)
 */
export async function requireAuth() {
  if (!isAuthenticated()) {
    window.location.href = '/';
    throw new Error('Not authenticated');
  }
}

/**
 * Require specific role (redirect if not authorized)
 * @param {string|string[]} allowedRoles - Allowed role(s)
 */
export async function requireRole(allowedRoles) {
  await requireAuth();
  
  const role = await getUserRole();
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  
  if (!roles.includes(role)) {
    // Redirect to appropriate page based on actual role
    redirectByRole(role);
    throw new Error('Not authorized');
  }
}

/**
 * Validate teacher access link
 * @param {string} linkToken - Teacher link token
 * @returns {Promise<object|null>} Teacher data or null
 */
export async function validateTeacherLink(linkToken) {
  try {
    // This will be handled by Cloud Function
    // For now, return null (will implement with Functions)
    console.log('Teacher link validation:', linkToken);
    return null;
  } catch (error) {
    console.error('Error validating teacher link:', error);
    return null;
  }
}

/**
 * Get error message in Hebrew
 * @param {Error} error - Error object
 * @returns {string} Hebrew error message
 */
export function getAuthErrorMessage(error) {
  const errorCode = error.code;
  
  const errorMessages = {
    'auth/invalid-email': 'כתובת אימייל לא תקינה',
    'auth/user-disabled': 'חשבון המשתמש הושבת',
    'auth/user-not-found': 'משתמש לא קיים במערכת',
    'auth/wrong-password': 'סיסמה שגויה',
    'auth/invalid-credential': 'אימייל או סיסמה שגויים',
    'auth/email-already-in-use': 'כתובת האימייל כבר בשימוש',
    'auth/weak-password': 'הסיסמה חלשה מדי',
    'auth/too-many-requests': 'יותר מדי ניסיונות. נסה שוב מאוחר יותר',
    'auth/network-request-failed': 'שגיאת רשת. בדוק את החיבור לאינטרנט'
  };
  
  return errorMessages[errorCode] || 'שגיאה בהתחברות. נסה שוב';
}
