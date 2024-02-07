const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// Route for user registration
router.post('/register', userController.register);

// Route for user login
router.post('/login', userController.login);

// Route for OTP verification
router.post('/verify-otp', userController.verifyOtp);

// Route to get all users (demonstrating a protected route, assuming you have middleware for authentication)
// Assuming you have an authentication middleware set up
const { authenticateToken } = require('../helpers/auth'); // Adjust path as necessary
router.get('/users', authenticateToken, userController.getAllUsers);

// Route to get a single user by ID
router.get('/users/:id', authenticateToken, userController.getUserById);

// Route to update a user by ID
router.put('/users/:id', authenticateToken, userController.updateUser);

// Route to delete a user by ID
router.delete('/users/:id', authenticateToken, userController.deleteUser);

// Route for users to initiate a password reset
router.post('/forgot-password', userController.forgotPassword);

// Route for searching users by username or email
router.get('/search', authenticateToken, userController.searchUsers);

module.exports = router;
