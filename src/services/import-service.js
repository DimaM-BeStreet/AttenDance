import * as XLSX from 'xlsx';
import { collection, doc, addDoc, updateDoc, query, where, getDocs, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@config/firebase-config';
import { formatIsraeliPhone } from '@utils/validation-utils';
import { createCourse } from './course-service.js';
import { createClassTemplate, getAllClassTemplates } from './class-template-service.js';
import { getAllTeachers } from './teacher-service.js';

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
  const studentsRef = collection(db, `businesses/${businessId}/students`);
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
    
    // Relational fields (Branch, Teacher, Course, Class)
    // These are expected to be IDs if mapped via the wizard, or strings if not
    ['branchId', 'teacherId', 'courseId', 'classId'].forEach(field => {
      if (columnMapping[field] !== undefined && row[columnMapping[field]]) {
        const value = row[columnMapping[field]];
        // If it's a string that looks like an ID (alphanumeric, > 5 chars) or was mapped
        // We assume it's valid. The wizard handles the mapping to IDs.
        if (value && value !== '__skip__' && value !== '__create__') {
          extracted[field] = value;
        }
      }
    });

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
  
  const studentsRef = collection(db, `businesses/${businessId}/students`);
  
  for (const studentData of students) {
    try {
      const data = {
        ...studentData.extracted,
        businessId: businessId,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        importedAt: serverTimestamp()
      };
      
      // Handle duplicates
      if (studentData.duplicate && options.updateDuplicates) {
        // Update existing student
        const studentRef = doc(db, `businesses/${businessId}/students`, studentData.duplicate.id);
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
 * Validate and prepare course data for import
 */
export async function validateCourseImport(rows, columnMapping, businessId) {
  const results = {
    valid: [],
    invalid: [],
    duplicates: [], // Not checking duplicates for courses for now
    totalRows: rows.length
  };

  // Load templates for name resolution
  const templates = await getAllClassTemplates(businessId);
  const templateMap = {}; // name -> id
  templates.forEach(t => {
    templateMap[t.name.toLowerCase().trim()] = t.id;
  });

  rows.forEach((row, index) => {
    const itemData = {
      rowIndex: index + 2,
      raw: row,
      errors: [],
      warnings: []
    };

    const extracted = {};

    // Required fields
    if (columnMapping.name !== undefined && row[columnMapping.name]) {
      extracted.name = String(row[columnMapping.name]).trim();
    } else {
      itemData.errors.push('חסר שם קורס');
    }

    if (columnMapping.startDate !== undefined && row[columnMapping.startDate]) {
      const val = row[columnMapping.startDate];
      // Handle Excel date (number) or string
      let date;
      if (typeof val === 'number') {
        date = new Date(Math.round((val - 25569) * 86400 * 1000));
      } else if (typeof val === 'string') {
        // Try DD/MM/YYYY
        const ddmmyyyy = val.match(/^(\d{1,2})[\/\.](\d{1,2})[\/\.](\d{4})$/);
        if (ddmmyyyy) {
            date = new Date(ddmmyyyy[3], ddmmyyyy[2] - 1, ddmmyyyy[1]);
        } else {
            date = new Date(val);
        }
      } else {
        date = new Date(val);
      }
      
      if (isNaN(date.getTime())) {
        itemData.errors.push('תאריך התחלה לא תקין');
      } else {
        extracted.startDate = date;
      }
    } else {
      itemData.errors.push('חסר תאריך התחלה');
    }

    if (columnMapping.endDate !== undefined && row[columnMapping.endDate]) {
      const val = row[columnMapping.endDate];
      let date;
      if (typeof val === 'number') {
        date = new Date(Math.round((val - 25569) * 86400 * 1000));
      } else if (typeof val === 'string') {
        // Try DD/MM/YYYY
        const ddmmyyyy = val.match(/^(\d{1,2})[\/\.](\d{1,2})[\/\.](\d{4})$/);
        if (ddmmyyyy) {
            date = new Date(ddmmyyyy[3], ddmmyyyy[2] - 1, ddmmyyyy[1]);
        } else {
            date = new Date(val);
        }
      } else {
        date = new Date(val);
      }
      
      if (isNaN(date.getTime())) {
        itemData.errors.push('תאריך סיום לא תקין');
      } else {
        extracted.endDate = date;
      }
    } else {
      itemData.errors.push('חסר תאריך סיום');
    }

    // Optional fields
    if (columnMapping.price !== undefined && row[columnMapping.price]) {
      const price = Number(row[columnMapping.price]);
      if (!isNaN(price)) extracted.price = price;
    }

    if (columnMapping.maxStudents !== undefined && row[columnMapping.maxStudents]) {
      const max = Number(row[columnMapping.maxStudents]);
      if (!isNaN(max)) extracted.maxStudents = max;
    }

    if (columnMapping.description !== undefined && row[columnMapping.description]) {
      extracted.description = String(row[columnMapping.description]).trim();
    }

    // Relational fields (Template ID)
    if (columnMapping.templateId !== undefined && row[columnMapping.templateId]) {
      const value = row[columnMapping.templateId];
      if (value && value !== '__skip__' && value !== '__create__') {
        if (!extracted.templateIds) extracted.templateIds = [];
        
        if (Array.isArray(value)) {
            value.forEach(v => {
                if (v && v !== '__skip__' && !extracted.templateIds.includes(v)) {
                    extracted.templateIds.push(v);
                }
            });
        } else {
            // Avoid duplicates
            if (!extracted.templateIds.includes(value)) {
              extracted.templateIds.push(value);
            }
        }
      }
    }

    itemData.extracted = extracted;

    if (itemData.errors.length > 0) {
      results.invalid.push(itemData);
    } else {
      results.valid.push(itemData);
    }
  });

  return results;
}

/**
 * Import courses to database
 */
export async function importCourses(items, businessId) {
  const results = {
    success: [],
    failed: []
  };

  // Load templates to generate schedule
  const templates = await getAllClassTemplates(businessId);
  const templatesMap = new Map(templates.map(t => [t.id, t]));

  for (const item of items) {
    try {
      const courseData = {
        ...item.extracted,
        isActive: true,
        schedule: [] 
      };

      // Generate schedule from templateIds if present
      if (courseData.templateIds && courseData.templateIds.length > 0) {
        courseData.schedule = courseData.templateIds.map(tId => {
            const template = templatesMap.get(tId);
            if (!template) return null;
            return {
                dayOfWeek: template.dayOfWeek,
                startTime: template.startTime,
                duration: template.duration,
                templateId: template.id,
                teacherId: template.teacherId,
                templateName: template.name,
                branchId: template.branchId
            };
        }).filter(s => s !== null);
      }
      
      const newCourse = await createCourse(businessId, courseData);
      results.success.push({ ...item, id: newCourse.id });
    } catch (error) {
      results.failed.push({ ...item, error: error.message });
    }
  }

  return results;
}

/**
 * Validate and prepare template data for import
 */
export async function validateTemplateImport(rows, columnMapping, businessId) {
  const results = {
    valid: [],
    invalid: [],
    duplicates: [],
    totalRows: rows.length
  };

  // Optimization: Fetch only relevant templates based on branches in the import file
  let existingTemplates = [];
  const branchColIndex = columnMapping.branchId;
  
  if (branchColIndex !== undefined) {
      const uniqueBranches = new Set();
      rows.forEach(row => {
          const val = row[branchColIndex];
          if (val && val !== '__skip__' && val !== '__create__') {
              uniqueBranches.add(val);
          }
      });
      
      if (uniqueBranches.size > 0) {
          // Fetch templates for each branch found in the file
          const promises = Array.from(uniqueBranches).map(bId => 
              getAllClassTemplates(businessId, { branchId: bId, isActive: true })
          );
          const results = await Promise.all(promises);
          existingTemplates = results.flat();
      } else {
          // Fallback if no valid branches found in rows
           existingTemplates = await getAllClassTemplates(businessId, { isActive: true });
      }
  } else {
      // Fallback if branch column not mapped
      existingTemplates = await getAllClassTemplates(businessId, { isActive: true });
  }

  rows.forEach((row, index) => {
    const itemData = {
      rowIndex: index + 2,
      raw: row,
      errors: [],
      warnings: []
    };

    const extracted = {};

    // Required fields
    if (columnMapping.name !== undefined && row[columnMapping.name]) {
      extracted.name = String(row[columnMapping.name]).trim();
    } else {
      itemData.errors.push('חסר שם תבנית');
    }

    if (columnMapping.duration !== undefined && row[columnMapping.duration]) {
      const duration = Number(row[columnMapping.duration]);
      if (!isNaN(duration) && duration > 0) {
        extracted.duration = duration;
      } else {
        itemData.errors.push('משך שיעור לא תקין');
      }
    } else {
      itemData.errors.push('חסר משך שיעור (דקות)');
    }

    // Optional fields
    if (columnMapping.description !== undefined && row[columnMapping.description]) {
      extracted.description = String(row[columnMapping.description]).trim();
    }

    if (columnMapping.price !== undefined && row[columnMapping.price]) {
      const price = Number(row[columnMapping.price]);
      if (!isNaN(price)) extracted.price = price;
    }

    if (columnMapping.dayOfWeek !== undefined) {
      const val = row[columnMapping.dayOfWeek];
      
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        let day = Number(val);
        
        if (isNaN(day)) {
          // Try to parse Hebrew day
          const strVal = String(val).trim().replace('יום', '').trim();
          
          const hebrewDays = {
            'א': 0, 'ראשון': 0,
            'ב': 1, 'שני': 1,
            'ג': 2, 'שלישי': 2,
            'ד': 3, 'רביעי': 3,
            'ה': 4, 'חמישי': 4,
            'ו': 5, 'שישי': 5,
            'ש': 6, 'שבת': 6
          };
          
          // Check exact match or partial match
          for (const [key, value] of Object.entries(hebrewDays)) {
            if (strVal === key || strVal.startsWith(key)) {
              day = value;
              break;
            }
          }
        }

        // 0-6
        if (!isNaN(day) && day >= 0 && day <= 6) {
          extracted.dayOfWeek = day;
        }
      }
    }

    if (columnMapping.startTime !== undefined && row[columnMapping.startTime]) {
      let timeVal = row[columnMapping.startTime];
      let timeStr = '';

      if (typeof timeVal === 'number') {
        // Handle Excel time fraction (0.0 to 1.0)
        // 1 day = 24 hours = 1440 minutes
        const totalMinutes = Math.round(timeVal * 24 * 60);
        const hours = Math.floor(totalMinutes / 60) % 24;
        const minutes = totalMinutes % 60;
        timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      } else {
        timeStr = String(timeVal).trim();
      }

      // Expect HH:mm
      if (/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(timeStr)) {
        extracted.startTime = timeStr;
      } else {
        itemData.warnings.push(`שעה לא תקינה: ${timeVal} (צריך להיות HH:mm)`);
      }
    }

    // Relational fields (Branch, Teacher ID, Location ID)
    ['branchId', 'teacherId', 'locationId'].forEach(field => {
      if (columnMapping[field] !== undefined && row[columnMapping[field]]) {
        const value = row[columnMapping[field]];
        if (value && value !== '__skip__' && value !== '__create__') {
          extracted[field] = value;
        }
      }
    });

    if (!extracted.teacherId) {
      const hasTeacherError = itemData.errors.some(e => e.includes('מורה'));
      if (!hasTeacherError) {
        itemData.errors.push('חסר מורה (שדה חובה)');
      }
    }

    if (!extracted.branchId) {
      const hasBranchError = itemData.errors.some(e => e.includes('סניף'));
      if (!hasBranchError) {
        itemData.errors.push('חסר סניף (שדה חובה)');
      }
    }

    if (!extracted.locationId) {
      const hasLocationError = itemData.errors.some(e => e.includes('מיקום'));
      if (!hasLocationError) {
        itemData.errors.push('חסר מיקום (שדה חובה)');
      }
    }

    // Check for duplicates in existing templates
    // Defining props: branch, day, time, location
    if (extracted.branchId && extracted.locationId && extracted.dayOfWeek !== undefined && extracted.startTime) {
        const isDuplicate = existingTemplates.some(t => 
            t.isActive &&
            t.branchId === extracted.branchId &&
            t.locationId === extracted.locationId &&
            t.dayOfWeek === extracted.dayOfWeek &&
            t.startTime === extracted.startTime
        );

        if (isDuplicate) {
            itemData.errors.push('תבנית כפולה: קיימת כבר תבנית פעילה באותו סניף, מיקום, יום ושעה');
        }
    }

    itemData.extracted = extracted;

    if (itemData.errors.length > 0) {
      results.invalid.push(itemData);
    } else {
      results.valid.push(itemData);
    }
  });

  return results;
}

/**
 * Import templates to database
 */
export async function importTemplates(items, businessId) {
  const results = {
    success: [],
    failed: []
  };

  for (const item of items) {
    try {
      const templateData = {
        ...item.extracted,
        isActive: true
      };
      
      const newTemplate = await createClassTemplate(businessId, templateData);
      
      // Auto-create course if price is provided or just as a default behavior (similar to manual creation)
      // The manual creation logic creates a course if one doesn't exist.
      // Here we can optionally create it.
      // If price is provided in the import, we definitely want to create the course with that price.
      
      try {
          const today = new Date();
          const nextYear = new Date();
          nextYear.setFullYear(today.getFullYear() + 1);
          
          // Construct schedule for the single template
          const schedule = [{
              dayOfWeek: templateData.dayOfWeek,
              startTime: templateData.startTime,
              duration: templateData.duration,
              templateId: newTemplate.id,
              teacherId: templateData.teacherId,
              templateName: templateData.name,
              branchId: templateData.branchId
          }];

          const courseData = {
              name: `רק ${templateData.name} (*אוטומטי)`,
              description: `קורס אוטומטי עבור תבנית ${templateData.name}`,
              templateIds: [newTemplate.id],
              startDate: today,
              endDate: nextYear,
              price: templateData.price !== undefined ? templateData.price : 0,
              maxStudents: null,
              isActive: true,
              autoCreated: true,
              schedule: schedule
          };
          
          await createCourse(businessId, courseData);
      } catch (courseError) {
          console.error('Error creating automatic course for imported template:', courseError);
          // We don't fail the template import if course creation fails
      }

      results.success.push({ ...item, id: newTemplate.id });
    } catch (error) {
      results.failed.push({ ...item, error: error.message });
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
