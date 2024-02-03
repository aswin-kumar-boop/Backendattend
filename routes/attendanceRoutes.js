const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');

// Route for recording session attendance
//router.post('/record-session-attendance', attendanceController.recordSessionAttendance);

// Check-in route
router.post('/attendance/check-in', attendanceController.checkIn);

// Check-out route
router.post('/attendance/check-out', attendanceController.checkOut);

// Get attendance summary
//router.get('/attendance/summary', attendanceController.getAttendanceSummary);

// Calculate monthly attendance
//router.get('/attendance/monthly', attendanceController.calculateMonthlyAttendance);

// Calculate semester attendance
//router.get('/attendance/semester', attendanceController.calculateSemesterAttendance);


module.exports = router;
