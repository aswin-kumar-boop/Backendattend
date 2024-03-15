// facultyRoutes.js
const express = require('express');
const router = express.Router();
const facultyController = require('../controllers/facultyController'); // Adjust the path as necessary
const { AuthMiddleware } = require('../helpers/studentmiddleware'); // Adjust paths according to your middleware location

// Define routes
router.post('/updateFacultyDetails', AuthMiddleware, facultyController.updateFacultyDetails);
router.get('/students', AuthMiddleware, facultyController.listStudentsByDepartment);
router.get('/student-requests', AuthMiddleware, facultyController.getStudentRequestsByYear);

// Export the router
module.exports = router;
