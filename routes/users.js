const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken } = require('../helpers/auth'); // Adjust path as necessary

// Route for user registration
router.post('/register', userController.register);

// Route for user login
router.post('/login', userController.login);

// Route for OTP verificationa
router.post('/verify-otp',userController.verifyOtp);

// Route for Rengerate OTP verification
router.post('/regenerate-otp', authenticateToken,userController.regenerateotp);

// Route to get all users (demonstrating a protected route, assuming you have middleware for authentication)
router.get('/users', authenticateToken, userController.getAllUsers);

// Route to get a single user by ID
router.get('/users/:id', authenticateToken, userController.getUserById);

// Route to update a user by ID
router.put('/users/:id', authenticateToken, userController.updateUser);

// Route to delete a user by ID
router.delete('/users/:id', authenticateToken, userController.deleteUser);

// Route for users to initiate a password reset
router.post('/forgot-password', authenticateToken,userController.forgotPassword);

// Route for users to initiate a password verify
router.post('/verify-password', authenticateToken,userController.verifyPassword);

// Route for searching users by username or email
router.get('/search', authenticateToken, userController.searchUsers);

// Route to count the number of users - New route added
router.get('/count',authenticateToken, userController.countUsers);

module.exports = router;
