const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentDetailsController');

// POST: Create a new student's details
router.post('/students', studentController.createStudentDetails);

// POST: Submit NFC data for a student
router.post('/students/nfc', studentController.submitNFCData);

// POST: Submit biometric data for a student
router.post('/students/biometric', studentController.submitBiometricData);

// GET: Retrieve a student's details by ID
router.get('/students/:id', studentController.getStudentDetails);

// PUT: Update a student's details by ID
router.put('/students/:id', studentController.updateStudentDetails);

// DELETE: Delete a student's details by ID
router.delete('/students/:id', studentController.deleteStudentDetails);

// GET: Retrieve all students' details
router.get('/students', studentController.getAllStudentDetails);

// POST: Register a new student with pending approval status
router.post('/students/register', studentController.registerStudent);

// POST: Reject and delete a student and their details
router.post('/students/:id/reject', studentController.rejectAndDeleteStudent);

// New route for approving a student
router.post('/students/approve/:id', studentController.approveStudent); 

 // New route for rejecting a student
router.post('/students/reject/:id', studentController.rejectStudent);  

router.get('/students/count', studentController.countTotalStudents);
router.get('/students/count/status', studentController.countStudentsByStatus);

module.exports = router;
