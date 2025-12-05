const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp();

// Import API endpoints
const authApi = require('./api/auth-api');
const teacherApi = require('./api/teacher-api');
const statsApi = require('./api/stats-api');
const attendanceApi = require('./api/attendance-api');

// Import scheduled functions
const { generateClassInstances } = require('./scheduled/generate-class-instances');

// Import triggers
const { onAttendanceCreated } = require('./triggers/attendance-notifications');
const { onEnrollmentCreated } = require('./triggers/enrollment-handlers');
const { 
  onAttendanceWritten, 
  onEnrollmentWritten, 
  onClassInstanceWritten 
} = require('./triggers/stats-triggers');

// Export Auth API endpoints
exports.validateTeacherLink = authApi.validateTeacherLink;
exports.generateTeacherLink = authApi.generateTeacherLink;

// Export Teacher API endpoints
exports.createTempStudent = teacherApi.createTempStudent;
exports.createTeacherSession = teacherApi.createTeacherSession;
exports.renewTeacherSession = teacherApi.renewTeacherSession;

// Export Attendance API endpoints
exports.markAttendance = attendanceApi.markAttendance;

// Export Stats API endpoints
exports.syncBusinessStats = statsApi.syncBusinessStats;

// Export scheduled functions
exports.generateClassInstances = generateClassInstances;

// Export triggers
exports.onAttendanceCreated = onAttendanceCreated;
exports.onEnrollmentCreated = onEnrollmentCreated;
exports.onAttendanceWritten = onAttendanceWritten;
exports.onEnrollmentWritten = onEnrollmentWritten;
exports.onClassInstanceWritten = onClassInstanceWritten;
