const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
//const authMiddleware = require('../middleware/authMiddleware');

// Register a new user
router.post('/register', userController.register);

// Login user
router.post('/login', userController.login);

// Get all users (protected route)
router.get('/', userController.getAllUsers);

// Get a single user by ID (protected route)
router.get('/:id', userController.getUserById);

// Update a user by ID (protected route)
router.put('/:id', userController.updateUser);

// Delete a user by ID (protected route)
router.delete('/:id', userController.deleteUser);

// Search for users by username or email (protected route)
router.post('/search',userController.searchUsers);

// Forgot password
router.post('/forgot-password', userController.forgotPassword);

module.exports = router;
