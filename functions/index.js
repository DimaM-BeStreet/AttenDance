const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp();

// Import API endpoints
const authApi = require('./api/auth-api');

// Import scheduled functions
const { generateClassInstances } = require('./scheduled/generate-class-instances');

// Import triggers
const { onAttendanceCreated } = require('./triggers/attendance-notifications');
const { onEnrollmentCreated } = require('./triggers/enrollment-handlers');

// Export Auth API endpoints
exports.validateTeacherLink = authApi.validateTeacherLink;
exports.generateTeacherLink = authApi.generateTeacherLink;

// Export scheduled functions
exports.generateClassInstances = generateClassInstances;

// Export triggers
exports.onAttendanceCreated = onAttendanceCreated;
exports.onEnrollmentCreated = onEnrollmentCreated;
