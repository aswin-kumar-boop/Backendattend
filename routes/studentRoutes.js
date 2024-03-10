const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentDetailsController');
const { body } = require('express-validator');
const middleware = require('../helpers/studentmiddleware');
const { authenticateToken } = require('../helpers/auth');

// POST: Create a new student's details
router.post(
    '/update-details/:id',
    [
        // Validate request body (you can add more validation as needed)
        body('name').notEmpty().withMessage('Name is required')
        // Add more validation rules here
    ],
    authenticateToken ,studentController.updateStudentDetails
);

// POST: Submit NFC data for a student
router.post('/students/nfc', authenticateToken ,studentController.updateNFCData);

// POST: Submit biometric data for a student
router.post('/students/biometric', authenticateToken ,studentController.updateBiometricData);

// GET: Retrieve a student's details by ID
router.get('/students/:id', authenticateToken ,studentController.getStudentDetails);

// PUT: Update a student's details by ID
router.put(
    '/students/:id',
    [
        // Validate request body (you can add more validation as needed)
        body('name').notEmpty().withMessage('Name is required'),
        body('email').isEmail().withMessage('Invalid email'),
        // Add more validation rules here
    ],
    studentController.updateStudentDetails
);

// DELETE: Delete a student's details by ID
router.delete('/students/:id', middleware.checkStudentExistence, studentController.deleteStudentDetails);

// GET: Retrieve all students' details
router.get('/students', studentController.getAllStudentDetails);

// POST: Register a new student with pending approval status
// router.post('/students/register', studentController.registerStudent);

// POST: Reject and delete a student and their details
//router.post('/students/:id/reject', middleware.checkStudentExistence, studentController.rejectAndDeleteStudent);

// New route for approving a student
router.post('/students/approve/:id',studentController.approveStudent);

// New route for rejecting a student
router.post('/students/reject/:id', studentController.rejectStudent);

router.get('/countTotalStudents', studentController.countTotalStudents);

router.get('/students/count/status', studentController.countStudentsByStatus);

module.exports = router;
