const express = require('express');
const router = express.Router();
const timetableController = require('../controllers/timetableController');

// Add a Class and its Timetable
router.post('/classWithTimetable', timetableController.addClassWithTimetable);

// Add a session to a specific class in the timetable
router.post('/addSession', timetableController.addSession);

// Update a session in the timetable
router.put('/updateSession/:timetableId/:sessionId', timetableController.updateSession);

// Delete a session from the timetable
router.delete('/deleteSession/:timetableId/:sessionId', timetableController.deleteSession);

// Get the weekly timetable for a class
router.get('/weeklyTimetable/:classId', timetableController.getWeeklyTimetable);

module.exports = router;
