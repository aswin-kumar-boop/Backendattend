require('dotenv').config();
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const User = require('../models/user'); // Adjust the path according to your project structure
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const StudentDetails = require('../models/StudentDetails');

// Environment variables
const jwtSecret = process.env.JWT_SECRET;
const emailUser = process.env.EMAIL_USER;
const emailPass = process.env.EMAIL_PASS;
const emailClientId = process.env.EMAIL_CLIENT_ID;
const emailClientSecret = process.env.EMAIL_CLIENT_SECRET;
const emailRefreshToken = process.env.EMAIL_REFRESH_TOKEN;
const emailService = process.env.EMAIL_SERVICE; // For example, 'Gmail'
const clientURL = process.env.CLIENT_URL; // Ensure this is HTTPS in production
const saltRounds = parseInt(process.env.SALT_ROUNDS) || 10;

// Email transport configuration using OAuth2 for Gmail
const transporter = nodemailer.createTransport({
  service: emailService,
  auth: {
    type: 'OAuth2',
    user: emailUser,
    clientId: emailClientId,
    clientSecret: emailClientSecret,
    refreshToken: emailRefreshToken,
  },
});

// Function to send OTP email
const sendOtpEmail = (email, otp) => {
  const mailOptions = {
    from: emailUser,
    to: email,
    subject: 'Verify your account',
    text: `Your verification code is: ${otp}\nThis code expires in 10 minutes.`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error('Error sending OTP email:', error);
    } else {
      console.log('OTP email sent:', info.response);
    }
  });
};

// Registration function with OTP
// Updated Registration Function with OTP
exports.register = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      // No need to manually set otp and otpExpires here
    });

    const otp = newUser.generateOtp(); // Utilize the generateOtp method
    await newUser.save(); // Save after generating the OTP to ensure otp and otpExpires are stored
    sendOtpEmail(email, otp); // This function remains unchanged, ensure it's implemented correctly

    res.status(201).json({ message: "Registration successful! Please verify your account with the OTP sent to your email." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error during registration.' });
  }
};

// OTP Verification Function
exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({
      email,
      otp,
      otpExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired OTP." });
    }

    user.isActive = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();
    res.status(200).json({ message: "Account verified successfully." });
  } catch (err) {
    res.status(500).json({ message: 'Error verifying OTP.' });
  }
};

// Login function
exports.login = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email }).select('+password');
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Authentication failed. User not found or account not activated.' });
    }

    const isMatch = await bcrypt.compare(req.body.password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Authentication failed. Wrong password.' });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

        // Optionally, fetch additional details if the user is a student
        let StudentDetails = {};
        if (user.role === 'student') {
            StudentDetails = await StudentDetails.findOne({ student: user._id });
        }

        res.json({
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                // Include any additional details you want in the navbar here
                StudentDetails,
            }
        });
    } catch (err) {
        res.status(500).json({ message: 'Error during login.', error: err.message });
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

// Forgot Password Function - Utilize the generatePasswordResetToken method
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const token = user.generatePasswordResetToken(); // Utilize the new method
    await user.save(); // Save the user document to store the reset token and its expiration

    // Update to use HTTPS in production for the clientURL
    const resetUrl = `${clientURL}/reset-password/${token}`;

    // Assuming sendEmail is a function you've implemented to handle email sending
    await sendEmail({
      to: user.email,
      subject: 'Password Reset Request',
      text: `To reset your password, please click on the following link: ${resetUrl}`
    });

    res.status(200).json({ message: 'Password reset email sent.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error sending password reset email.' });
  }
};

// Function to count the number of users
exports.countUsers = async (req, res) => {
  try {
    const userCount = await User.countDocuments();
    res.json({ totalUsers: userCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
