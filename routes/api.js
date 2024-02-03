const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const validationMiddleware = require('../helpers/validationMiddleware');

// POST route for student check-in
router.post('/check-in', validationMiddleware.validateCheckInData, attendanceController.checkIn);

// POST route for student check-out
router.post('/check-out', attendanceController.checkOut);

module.exports = router;
