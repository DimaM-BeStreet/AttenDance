const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp();

// Import API endpoints
const authApi = require('./api/auth-api');
const businessApi = require('./api/business-api');
const studentApi = require('./api/student-api');
const teacherApi = require('./api/teacher-api');
const classApi = require('./api/class-api');
const enrollmentApi = require('./api/enrollment-api');
const attendanceApi = require('./api/attendance-api');

// Import scheduled functions
const generateClassInstances = require('./scheduled/generate-class-instances');

// Import triggers
const attendanceNotifications = require('./triggers/attendance-notifications');
const enrollmentHandlers = require('./triggers/enrollment-handlers');

// Export API endpoints
exports.auth = authApi;
exports.business = businessApi;
exports.student = studentApi;
exports.teacher = teacherApi;
exports.class = classApi;
exports.enrollment = enrollmentApi;
exports.attendance = attendanceApi;

// Export scheduled functions
exports.generateClassInstances = generateClassInstances;

// Export triggers
exports.onAttendanceCreated = attendanceNotifications.onAttendanceCreated;
exports.onEnrollmentCreated = enrollmentHandlers.onEnrollmentCreated;
