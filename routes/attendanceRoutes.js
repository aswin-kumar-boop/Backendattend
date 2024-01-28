const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');

// Route for recording session attendance
router.post('/record-session-attendance', attendanceController.recordSessionAttendance);

// Route for handling student check-in
router.post('/check-in', attendanceController.checkIn);

// Route for handling student check-out
router.post('/check-out', attendanceController.checkOut);

// Route for calculating monthly attendance
router.get('/calculate-monthly-attendance', attendanceController.calculateMonthlyAttendance);

// Route for calculating semester attendance
router.get('/calculate-semester-attendance', attendanceController.calculateSemesterAttendance);

// Route for getting attendance summary
router.get('/get-attendance-summary', attendanceController.getAttendanceSummary);


// Separate routes for check-in and check-out
router.post('/attendance/check-in', attendanceController.checkIn);
router.post('/attendance/check-out', attendanceController.checkOut);

module.exports = router;
