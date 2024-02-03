const express = require('express');
const router = express.Router();
const timetableController = require('../controllers/timetableController');

// Define routes for timetable component
router.get('/timetable', timetableController.addClassWithTimetable);
router.post('/timetable', timetableController.addSession);
router.put('/timetable/:sessionId', timetableController.updateSession);
router.delete('/timetable/:sessionId', timetableController.deleteSession);

module.exports = router;
