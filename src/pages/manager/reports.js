import { 
  getReportData 
} from '../../services/student-stats-service.js';
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  orderBy,
  doc,
  getDoc
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions, auth } from '@config/firebase-config';
import { onAuthStateChanged } from 'firebase/auth';
import { createNavbar } from '../../components/navbar.js';
import { showModal, closeModal, showConfirm, showToast } from '../../components/modal.js';

// Import Styles
import '../../styles/main.css';
import '../../styles/rtl.css';
import '../../styles/mobile.css';

// State
let currentBusinessId = null;
let branches = [];
let teachers = [];

// DOM Elements
const reportTypeSelect = document.getElementById('reportType');
const reportDescription = document.getElementById('reportDescription');
const branchSelect = document.getElementById('branchFilter');
const teacherFilterInput = document.getElementById('teacherFilter'); // Hidden input
const teacherSearchInput = document.getElementById('teacherSearch'); // Visible input
const teacherResults = document.getElementById('teacherResults'); // Dropdown
const startDateInput = document.getElementById('startDate');
const endDateInput = document.getElementById('endDate');
const generateBtn = document.getElementById('generateBtn');
const syncBtn = document.getElementById('syncStatsBtn');
const syncStatus = document.getElementById('syncStatus');
const syncProgressFill = document.getElementById('syncProgress');
const syncCount = document.getElementById('syncCount');
const resultsTable = document.getElementById('resultsTable');
const resultsTableBody = resultsTable.querySelector('tbody');
const emptyState = document.getElementById('emptyState');
const resultCount = document.getElementById('resultCount');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = '/login.html';
      return;
    }

    try {
      // Verify role and get businessId
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.data();
      
      if (!userData || !['superAdmin', 'admin', 'manager'].includes(userData.role)) {
        showToast('אין לך הרשאות לצפות בדף זה', 'error');
        window.location.href = '/';
        return;
      }

      currentBusinessId = userData.businessId;
      
      // Initialize navbar
      createNavbar();

      // Hide table initially
      if (resultsTable) resultsTable.style.display = 'none';
      
      await loadFilters();
      setupEventListeners();

    } catch (error) {
      console.error('Error initializing reports page:', error);
      showToast('שגיאה בטעינת הדף', 'error');
    }
  });
});

async function loadFilters() {
  try {
    // Load Branches
    const branchesSnapshot = await getDocs(collection(db, `businesses/${currentBusinessId}/branches`));
    branches = branchesSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    
    branchSelect.innerHTML = '<option value="">כל הסניפים</option>';
    branches.forEach(branch => {
      const option = document.createElement('option');
      option.value = branch.id;
      option.textContent = branch.name;
      branchSelect.appendChild(option);
    });

    // Initialize teacher cache from session storage
    const CACHE_KEY = `teacher_search_cache_${currentBusinessId}`;
    try {
        const savedCache = sessionStorage.getItem(CACHE_KEY);
        if (savedCache) {
            teacherSearchCache = JSON.parse(savedCache);
        }
    } catch (e) {
        console.error('Error loading teacher cache', e);
    }
    
    // Setup Autocomplete
    setupTeacherAutocomplete();

  } catch (error) {
    console.error('Error loading filters:', error);
  }
}

// Cache for teacher search results
let teacherSearchCache = {};

function setupTeacherAutocomplete() {
  let debounceTimeout;
  const CACHE_KEY = `teacher_search_cache_${currentBusinessId}`;

  // Search function
  const searchTeachers = async (term) => {
    if (!term) return [];
    
    // Check cache
    if (teacherSearchCache[term]) {
        return teacherSearchCache[term];
    }

    // Fetch from DB
    const teachersRef = collection(db, `businesses/${currentBusinessId}/teachers`);
    
    // Search by first name and last name (starts with)
    // Note: This is case-sensitive in Firestore. 
    // Ideally we would store a normalized lowercase name for searching.
    const [firstNameSnap, lastNameSnap] = await Promise.all([
        getDocs(query(teachersRef, 
            where('firstName', '>=', term), 
            where('firstName', '<=', term + '\uf8ff')
        )),
        getDocs(query(teachersRef, 
            where('lastName', '>=', term), 
            where('lastName', '<=', term + '\uf8ff')
        ))
    ]);

    const resultsMap = new Map();
    firstNameSnap.docs.forEach(doc => resultsMap.set(doc.id, { id: doc.id, ...doc.data() }));
    lastNameSnap.docs.forEach(doc => resultsMap.set(doc.id, { id: doc.id, ...doc.data() }));
    
    const results = Array.from(resultsMap.values());
    
    // Update cache
    teacherSearchCache[term] = results;
    try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(teacherSearchCache));
    } catch (e) {
        console.warn('Session storage full, cannot cache results');
    }
    
    return results;
  };

  // Render results
  const renderResults = (results) => {
    teacherResults.innerHTML = '';
    
    // Add "All Teachers" option if search is empty
    if (!teacherSearchInput.value) {
        const allOption = document.createElement('div');
        allOption.className = 'autocomplete-item';
        allOption.textContent = 'כל המורים';
        allOption.onclick = () => selectTeacher(null, '');
        teacherResults.appendChild(allOption);
        return;
    }

    if (results.length === 0) {
      teacherResults.innerHTML = '<div class="autocomplete-item">לא נמצאו תוצאות</div>';
      return;
    }

    results.forEach(teacher => {
      const div = document.createElement('div');
      div.className = 'autocomplete-item';
      div.textContent = `${teacher.firstName} ${teacher.lastName}`;
      div.onclick = () => selectTeacher(teacher.id, `${teacher.firstName} ${teacher.lastName}`);
      teacherResults.appendChild(div);
    });
  };

  // Select teacher
  const selectTeacher = (id, name) => {
    teacherFilterInput.value = id || '';
    teacherSearchInput.value = name;
    teacherResults.classList.remove('show');
  };

  // Event Listeners
  teacherSearchInput.addEventListener('input', (e) => {
    const term = e.target.value.trim();
    
    // Clear hidden ID if user changes text (force re-selection)
    if (teacherFilterInput.value && term !== '') {
        teacherFilterInput.value = '';
    }

    if (!term) {
        renderResults([]);
        teacherResults.classList.add('show');
        return;
    }

    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(async () => {
        teacherResults.innerHTML = '<div class="autocomplete-item">מחפש...</div>';
        teacherResults.classList.add('show');
        
        try {
            const results = await searchTeachers(term);
            renderResults(results);
        } catch (error) {
            console.error('Search error:', error);
            teacherResults.innerHTML = '<div class="autocomplete-item error">שגיאה בחיפוש</div>';
        }
    }, 300);
  });

  teacherSearchInput.addEventListener('focus', () => {
    if (!teacherSearchInput.value) {
        renderResults([]);
        teacherResults.classList.add('show');
    } else {
        // Trigger search for existing value
        teacherSearchInput.dispatchEvent(new Event('input'));
    }
  });

  // Close when clicking outside
  document.addEventListener('click', (e) => {
    if (!teacherSearchInput.contains(e.target) && !teacherResults.contains(e.target)) {
      teacherResults.classList.remove('show');
    }
  });
}

// Report Descriptions
const REPORT_DESCRIPTIONS = {
  first_class_no_attendance: "דוח זה מציג תלמידים שהוזמנו לשיעור ניסיון או שיעור ראשון אך לא נרשמה להם נוכחות (סומנו כנעדרים או לא סומנו כלל). זהו כלי חשוב למעקב אחר 'לידים' שאבדו בשלב ההגעה.",
  first_attendance_no_course: "דוח זה מציג תלמידים שהגיעו פיזית לשיעור (למשל שיעור ניסיון) וסומנו כנוכחים אך עדיין לא הוגדרו כרשומים פעילים באף קורס. אלו תלמידים שנמצאים בשלב 'התלבטות' או שהרישום שלהם התפספס.",
  active_no_class: "דוח זה מציג תלמידים שמוגדרים במערכת כ'פעילים' אך בפועל אינם משובצים לאף שיעור ואינם רשומים לאף קורס פעיל. ייתכן שמדובר ברישום שגוי, תלמידים חדשים שטרם שובצו, או תלמידים שהפסיקו להגיע אך הסטטוס שלהם לא עודכן."
};

function setupEventListeners() {
  generateBtn.addEventListener('click', generateReport);
  syncBtn.addEventListener('click', syncData);
  
  // Update description on change
  reportTypeSelect.addEventListener('change', updateReportDescription);
  
  // Initial update
  updateReportDescription();
}

function updateReportDescription() {
  const type = reportTypeSelect.value;
  reportDescription.textContent = REPORT_DESCRIPTIONS[type] || '';
}

async function syncData() {
  if (!await showConfirm({ title: 'סנכרון נתונים', message: 'פעולה זו תחשב מחדש את הסטטיסטיקות עבור כל התלמידים. זה עשוי לקחת מספר דקות. להמשיך?' })) {
    return;
  }

  syncBtn.disabled = true;
  syncStatus.style.display = 'block';
  syncProgressFill.style.width = '100%'; // Indeterminate state
  syncProgressFill.classList.add('progress-bar-animated', 'progress-bar-striped');
  syncCount.textContent = 'מעבד נתונים בשרת...';

  try {
    const syncBusinessStats = httpsCallable(functions, 'syncBusinessStats');
    const result = await syncBusinessStats({ businessId: currentBusinessId });
    
    const data = result.data;
    console.log('Sync result:', data);

    if (data.success) {
      let msg = `סנכרון הנתונים הושלם בהצלחה!\nעודכנו: ${data.updated} תלמידים\nשגיאות: ${data.errors}`;
      if (data.errors > 0 && data.errorDetails) {
        msg += `\n\nפירוט שגיאות:\n${data.errorDetails.slice(0, 5).join('\n')}`;
        if (data.errorDetails.length > 5) {
          msg += `\n...ועוד ${data.errorDetails.length - 5}`;
        }
      }
      showToast(msg);
    } else {
      showToast('הסנכרון הסתיים עם שגיאות. בדוק את הקונסול.', 'error');
    }
  } catch (error) {
    console.error('Sync error:', error);
    showToast('שגיאה בסנכרון הנתונים. וודא שיש לך הרשאות מתאימות.', 'error');
  } finally {
    syncBtn.disabled = false;
    syncProgressFill.classList.remove('progress-bar-animated', 'progress-bar-striped');
    setTimeout(() => {
      syncStatus.style.display = 'none';
    }, 3000);
  }
}

async function generateReport() {
  generateBtn.disabled = true;
  generateBtn.textContent = 'טוען...';
  
  // Show loading state in table
  resultsTable.style.display = 'table';
  emptyState.style.display = 'none';
  resultsTableBody.innerHTML = '<tr><td colspan="5" class="text-center">טוען נתונים...</td></tr>';

  try {
    const type = reportTypeSelect.value;
    const filters = {
      branchId: branchSelect.value || null,
      teacherId: teacherFilterInput.value || null,
      startDate: startDateInput.value ? new Date(startDateInput.value) : null,
      endDate: endDateInput.value ? new Date(endDateInput.value) : null
    };

    const students = await getReportData(currentBusinessId, type, filters);
    renderResults(students, type);

  } catch (error) {
    console.error('Report error:', error);
    resultsTableBody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">שגיאה: ${error.message}</td></tr>`;
  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent = 'הפק דוח';
  }
}

function renderResults(students, type) {
  resultsTableBody.innerHTML = '';
  resultCount.textContent = students.length;
  resultCount.style.display = 'inline-block';

  if (students.length === 0) {
    resultsTableBody.innerHTML = '<tr><td colspan="5" class="text-center">לא נמצאו רשומות תואמות.</td></tr>';
    return;
  }

  students.forEach(student => {
    const tr = document.createElement('tr');
    
    // Common Columns
    const nameCell = `<td>${student.firstName} ${student.lastName}</td>`;
    const phoneCell = `<td>${student.phone || '-'}</td>`;
    
    let detailsCell = '';
    let dateCell = '';
    let statusCell = `<td><span class="badge ${student.isActive ? 'bg-success' : 'bg-secondary'}">${student.isActive ? 'פעיל' : 'לא פעיל'}</span></td>`;

    // Specific Columns based on report type
    if (type === 'first_class_no_attendance') {
      const date = student.stats?.firstClassDate ? new Date(student.stats.firstClassDate.seconds * 1000).toLocaleDateString('he-IL') : 'N/A';
      dateCell = `<td>שיעור ראשון: ${date}</td>`;
      detailsCell = `<td>לא נכח בשיעור הראשון</td>`;
    } else if (type === 'first_attendance_no_course') {
      const date = student.stats?.firstAttendanceDate ? new Date(student.stats.firstAttendanceDate.seconds * 1000).toLocaleDateString('he-IL') : 'N/A';
      dateCell = `<td>נוכחות ראשונה: ${date}</td>`;
      detailsCell = `<td>נכח אך ללא קורס פעיל</td>`;
    } else if (type === 'active_no_class') {
      dateCell = `<td>-</td>`;
      detailsCell = `<td>תלמיד פעיל ללא שיעורים או קורסים</td>`;
    }

    tr.innerHTML = nameCell + phoneCell + dateCell + detailsCell + statusCell;
    resultsTableBody.appendChild(tr);
  });
}

// Start
// init(); // Removed manual init call as we now use DOMContentLoaded + onAuthStateChanged
