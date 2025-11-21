import * as XLSX from 'xlsx';
import { collection, doc, addDoc, updateDoc, query, where, getDocs, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@config/firebase-config';
import { formatIsraeliPhone } from '@utils/validation-utils';

/**
 * Import Service
 * Handles student data import from Excel/CSV files
 */

/**
 * Parse Excel or CSV file
 * @param {File} file - The file to parse
 * @returns {Promise<Object>} Parsed data with headers and rows
 */
export async function parseImportFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Get first sheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON (array of objects)
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (jsonData.length === 0) {
          reject(new Error('הקובץ ריק'));
          return;
        }
        
        // First row is headers
        const headers = jsonData[0];
        const rows = jsonData.slice(1).filter(row => row.length > 0);
        
        resolve({
          headers,
          rows,
          totalRows: rows.length,
          fileName: file.name
        });
      } catch (error) {
        reject(new Error('שגיאה בקריאת הקובץ: ' + error.message));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('שגיאה בטעינת הקובץ'));
    };
    
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Validate and prepare student data for import
 * @param {Array} rows - Raw data rows
 * @param {Object} columnMapping - Mapping of column indices to field names
 * @param {string} businessId - Business ID
 * @returns {Object} Validation results with prepared data
 */
export async function validateImportData(rows, columnMapping, businessId) {
  const results = {
    valid: [],
    invalid: [],
    duplicates: [],
    totalRows: rows.length
  };
  
  // Get existing students to check for duplicates
  const studentsRef = collection(db, `studios/${businessId}/students`);
  const existingStudents = await getDocs(studentsRef);
  const existingPhones = new Set();
  const phoneToStudentMap = {};
  
  existingStudents.forEach(doc => {
    const student = doc.data();
    if (student.phone) {
      const normalizedPhone = normalizePhone(student.phone);
      existingPhones.add(normalizedPhone);
      phoneToStudentMap[normalizedPhone] = {
        id: doc.id,
        ...student
      };
    }
  });
  
  rows.forEach((row, index) => {
    const studentData = {
      rowIndex: index + 2, // +2 because row 1 is headers and arrays are 0-indexed
      raw: row,
      errors: [],
      warnings: []
    };
    
    // Extract data based on column mapping
    const extracted = {};
    
    // Required fields
    const nameCol = columnMapping.name;
    const phoneCol = columnMapping.phone;
    const birthYearCol = columnMapping.birthYear;
    
    // Extract and validate name
    if (nameCol !== undefined && row[nameCol]) {
      const fullName = String(row[nameCol]).trim();
      const nameParts = fullName.split(/\s+/);
      extracted.firstName = nameParts[0] || '';
      extracted.lastName = nameParts.slice(1).join(' ') || '';
      
      if (!extracted.firstName) {
        studentData.errors.push('חסר שם');
      }
    } else {
      studentData.errors.push('חסר שם (שדה חובה)');
    }
    
    // Extract and validate phone
    if (phoneCol !== undefined && row[phoneCol]) {
      const phone = String(row[phoneCol]).trim();
      try {
        extracted.phone = formatIsraeliPhone(phone);
        
        // Check for duplicates
        const normalizedPhone = normalizePhone(extracted.phone);
        if (existingPhones.has(normalizedPhone)) {
          studentData.duplicate = phoneToStudentMap[normalizedPhone];
          studentData.warnings.push('תלמיד קיים עם מספר טלפון זהה');
        }
      } catch (error) {
        studentData.errors.push('מספר טלפון לא תקין');
      }
    } else {
      studentData.errors.push('חסר טלפון (שדה חובה)');
    }
    
    // Extract and validate birth year
    if (birthYearCol !== undefined && row[birthYearCol]) {
      const birthYear = parseInt(row[birthYearCol]);
      const currentYear = new Date().getFullYear();
      
      if (isNaN(birthYear) || birthYear < 1900 || birthYear > currentYear) {
        studentData.errors.push('שנת לידה לא תקינה');
      } else {
        // Create birthDate as January 1st of birth year
        extracted.birthDate = new Date(birthYear, 0, 1);
      }
    } else {
      studentData.errors.push('חסרה שנת לידה (שדה חובה)');
    }
    
    // Optional fields
    if (columnMapping.parentName !== undefined && row[columnMapping.parentName]) {
      extracted.parentName = String(row[columnMapping.parentName]).trim();
    }
    
    if (columnMapping.parentPhone !== undefined && row[columnMapping.parentPhone]) {
      try {
        extracted.parentPhone = formatIsraeliPhone(String(row[columnMapping.parentPhone]).trim());
      } catch (error) {
        studentData.warnings.push('מספר טלפון הורה לא תקין - לא יובא');
      }
    }
    
    if (columnMapping.parentEmail !== undefined && row[columnMapping.parentEmail]) {
      extracted.parentEmail = String(row[columnMapping.parentEmail]).trim();
    }
    
    if (columnMapping.address !== undefined && row[columnMapping.address]) {
      extracted.address = String(row[columnMapping.address]).trim();
    }
    
    if (columnMapping.medicalNotes !== undefined && row[columnMapping.medicalNotes]) {
      extracted.medicalNotes = String(row[columnMapping.medicalNotes]).trim();
    }
    
    if (columnMapping.photoURL !== undefined && row[columnMapping.photoURL]) {
      const url = String(row[columnMapping.photoURL]).trim();
      if (url.startsWith('http://') || url.startsWith('https://')) {
        extracted.photoURL = url;
      } else {
        studentData.warnings.push('כתובת תמונה לא תקינה - לא תיובא');
      }
    }
    
    // Custom fields
    if (columnMapping.customFields) {
      extracted.customFields = {};
      
      Object.entries(columnMapping.customFields).forEach(([fieldName, colIndex]) => {
        if (colIndex !== undefined && row[colIndex]) {
          const value = row[colIndex];
          
          // Auto-detect type
          if (typeof value === 'number') {
            extracted.customFields[fieldName] = value;
          } else if (typeof value === 'boolean') {
            extracted.customFields[fieldName] = value;
          } else {
            const strValue = String(value).trim().toLowerCase();
            // Check for boolean values in Hebrew/English
            if (['true', 'כן', 'yes', '1'].includes(strValue)) {
              extracted.customFields[fieldName] = true;
            } else if (['false', 'לא', 'no', '0'].includes(strValue)) {
              extracted.customFields[fieldName] = false;
            } else if (!isNaN(Number(value))) {
              extracted.customFields[fieldName] = Number(value);
            } else {
              extracted.customFields[fieldName] = String(value).trim();
            }
          }
        }
      });
    }
    
    studentData.extracted = extracted;
    
    // Categorize
    if (studentData.errors.length > 0) {
      results.invalid.push(studentData);
    } else if (studentData.duplicate) {
      results.duplicates.push(studentData);
    } else {
      results.valid.push(studentData);
    }
  });
  
  return results;
}

/**
 * Import students to database
 * @param {Array} students - Array of student data to import
 * @param {string} businessId - Business ID
 * @param {Object} options - Import options (updateDuplicates, etc.)
 * @returns {Promise<Object>} Import results
 */
export async function importStudents(students, businessId, options = {}) {
  const results = {
    success: [],
    failed: [],
    updated: []
  };
  
  const studentsRef = collection(db, `studios/${businessId}/students`);
  
  for (const studentData of students) {
    try {
      const data = {
        ...studentData.extracted,
        studioId: businessId,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        importedAt: serverTimestamp()
      };
      
      // Handle duplicates
      if (studentData.duplicate && options.updateDuplicates) {
        // Update existing student
        const studentRef = doc(db, `studios/${businessId}/students`, studentData.duplicate.id);
        await updateDoc(studentRef, {
          ...data,
          createdAt: studentData.duplicate.createdAt // Preserve original
        });
        results.updated.push({
          ...studentData,
          id: studentData.duplicate.id
        });
      } else if (!studentData.duplicate) {
        // Create new student
        const docRef = await addDoc(studentsRef, data);
        results.success.push({
          ...studentData,
          id: docRef.id
        });
      }
    } catch (error) {
      results.failed.push({
        ...studentData,
        error: error.message
      });
    }
  }
  
  return results;
}

/**
 * Normalize phone number for comparison
 */
function normalizePhone(phone) {
  return phone.replace(/\D/g, '');
}

/**
 * Get sample data from parsed file (first 5 rows)
 */
export function getSampleData(parsedData) {
  return {
    headers: parsedData.headers,
    rows: parsedData.rows.slice(0, 5),
    totalRows: parsedData.totalRows
  };
}
