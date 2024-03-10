const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');

// Route for recording session attendance
//router.post('/record-session-attendance', attendanceController.recordSessionAttendance);

// Check-in route
router.post('/attendance/check-in', attendanceController.checkIn);

// Check-out route
router.post('/attendance/check-out', attendanceController.checkOut);

// Define the route for fetching attendance summary
router.get('/api/students/:studentId/attendance-summary', attendanceController.getAttendanceSummary);

// Get attendance summary
router.get('/attendance/summary', attendanceController.GetAttendanceSummary);

// Calculate monthly attendance
//router.get('/attendance/monthly', attendanceController.calculateMonthlyAttendance);

// Calculate semester attendance
//router.get('/attendance/semester', attendanceController.calculateSemesterAttendance);


module.exports = router;
