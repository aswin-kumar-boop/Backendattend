const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const User = require('../models/user'); // Import your User model
const https = require('https');
const fs = require('fs');

const jwt = require('jsonwebtoken');

const jwtSecret = 'your_jwt_secret'; // Ideally, this should be in an environment variable

// Function to handle user registration
exports.register = async (req, res) => {
  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email: req.body.email });
    if (existingUser) {
      return res.status(400).send('User already exists');
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(req.body.password, 10);

    // Create a new user
    const user = new User({
      username: req.body.username,
      email: req.body.email,
      password: hashedPassword
    });

    // Save the user
    const newUser = await user.save();
    res.status(201).json(newUser);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Function to handle user login
exports.login = async (req, res) => {
  try {
    // Find the user by email
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      return res.status(401).send('Authentication failed. User not found.');
    }

    // Check if the password is correct
    const isMatch = await bcrypt.compare(req.body.password, user.password);
    if (!isMatch) {
      return res.status(401).send('Authentication failed. Wrong password.');
    }

    // Generate a token
    const token = jwt.sign({ userId: user._id }, jwtSecret, { expiresIn: '1h' });

    // Send the token to the client
    res.json({ token: token });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Function to get all users
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Function to get a single user by ID
exports.getUserById = async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Function to update a user by ID
exports.updateUser = async (req, res) => {
  try {
    const userId = req.params.id;
    const updatedUser = await User.findByIdAndUpdate(userId, req.body, { new: true });
    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(updatedUser);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Function to delete a user by ID
exports.deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;
    const deletedUser = await User.findByIdAndDelete(userId);
    if (!deletedUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(204).send(); // Respond with a 204 status (No Content) for successful deletion
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Function to search for users by username or email
exports.searchUsers = async (req, res) => {
  try {
    const searchPattern = req.body.search;

    // Use regex to perform a case-insensitive search
    const users = await User.find({
      $or: [
        { username: { $regex: searchPattern, $options: 'i' } },
        { email: { $regex: searchPattern, $options: 'i' } }
      ]
    });

    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Function to handle forgot password
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // Generate a reset token
    const resetToken = crypto.randomBytes(20).toString('hex');

    // Find the user by email
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Set the reset token and expiration time in the user document
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // Token expires in 1 hour

    await user.save();

    // Create a reusable transporter object using nodemailer
    const transporter = nodemailer.createTransport({
      service: 'Gmail', // Change to your email service (e.g., Gmail, Outlook)
      auth: {
        user: 'ashwinkumarka52@gmail.com', // Your email address
        pass: 'Aashwinkumarka808650@' // Your email password
      },
      tls: {
        rejectUnauthorized: false // Allow self-signed certificates for development
      }
    });

    // Email body with the reset link
    const mailOptions = {
      from: 'your.email@gmail.com',
      to: email,
      subject: 'Password Reset',
      text: `You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n`
        + `Please click on the following link, or paste this into your browser to complete the process:\n\n`
        + `http://localhost:3000/reset/${resetToken}\n\n`
        + `If you did not request this, please ignore this email, and your password will remain unchanged.\n`
    };

    // Send the email
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.log(error);
        return res.status(500).json({ message: 'Error sending email' });
      } else {
        console.log('Email sent: ' + info.response);
        return res.status(200).json({ message: 'Password reset email sent' });
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};