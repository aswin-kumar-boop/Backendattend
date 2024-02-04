// In routes/api.js or a new routes/analyticsRoutes.js
const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');

router.get('/reports/attendance', analyticsController.generateAttendanceReport);

module.exports = router;
