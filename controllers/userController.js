require("dotenv").config();
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const User = require("../models/user"); // Adjust the path according to your project structure
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const StudentDetails = require("../models/StudentDetails");

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
    type: "OAuth2",
    user: emailUser,
    clientId: emailClientId,
    clientSecret: emailClientSecret,
    refreshToken: emailRefreshToken,
  },
});

// Function to send OTP email
const sendEmail = (email, subject, text) => {
  const mailOptions = {
    from: emailUser,
    to: email,
    subject: subject,
    text: text,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error("Error sending email:", error);
    } else {
      console.log("Email sent:", info.response);
    }
  });
};

// Registration function with OTP
// Updated Registration Function with OTP
exports.register = async (req, res) => {
  try {
    const { username, email, password, confirmPassword, role } = req.body;

    // Validate confirmation password
    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match." });
    }

    // Check if the user already exists by username or email
    const existingUser = await User.findOne({
      $or: [{ username }, { email }],
    });

    if (existingUser) {
      // Handle the case where the user exists but is not verified
      if (!existingUser.isVerified) {
        const otp = existingUser.generateOtp();
        await existingUser.save();
        sendEmail(email, "Verify your account", `Your verification code is: ${otp}\nThis code expires in 10 minutes.`);
        return res.status(201).json({
          success: true,
          message: "User already registered. Please verify your account with the OTP sent to your email.",
        });
      }
      // Handle the case where the user is already verified
      return res.status(400).json({ message: "User already exists." });
    }

    // Proceed with new user registration
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      role,
      isVerified: false,
    });

    const otp = newUser.generateOtp();
    await newUser.save();
    sendEmail(email, "Verify your account", `Your verification code is: ${otp}\nThis code expires in 10 minutes.`);

    return res.status(201).json({
      success: true,
      message: "Registration successful! Please verify your account with the OTP sent to your email.",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Error during registration." });
  }
};


async function generateStudentId() {
  let unique = false;
  let studentId;
  while (!unique) {
    const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase(); // Generate a random string
    const timestampPart = Date.now().toString().slice(-6); // Get the last 6 digits of the current timestamp
    studentId = `CT${timestampPart}${randomPart}`; // Combine them to form the ID

    // Check if this ID already exists in the database
    const existingId = await StudentDetails.findOne({ studentId });
    if (!existingId) {
      unique = true; // If the ID doesn't exist, break out of the loop
    }
  }
  return studentId;
}
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
   
    const isOtpValid = user.otp === otp && user.otpExpires.getTime() > Date.now();
     if (!isOtpValid) return res.status(400).json({ message: 'Invalid or expired OTP' });
    
    // Generate unique studentId
    const studentId = await generateStudentId(); // This function was previously defined

    // Create StudentDetails document
    const studentDetails = new StudentDetails({
      user: user._id,
      studentId,
      // Set default or empty values for other fields as necessary
      name: "", // Example: These fields should be updated by the user later
      course: "",
      year: 0,
      section: "",
      academicLevel: "",
      currentSemester:"",
      status:'pending_approval',
      // Add any additional fields as needed
    });

    await studentDetails.save();

    user.isActive = true;
    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

     // Send studentId via email
     sendEmail(email, "Your Student ID", `Your unique student ID is: ${studentId}`);

    res.status(200).json({ message: "Account verified successfully." });
  } catch (err) {
    res.status(500).json({ message: "Error verifying OTP." });
  }
};

// Endpoint to regenerate OTP
exports.regenerateotp = async (req, res) => {
  const { email } = req.body;
  try {
    let user = await User.findOne({ email });
    if (!user) return res.status(404).send('User not found');

    // Check if the user has already verified the account to prevent OTP resend after verification
    if (user.isActive) return res.status(400).send('Account already verified. OTP regeneration not allowed.');

    const otp = user.generateOtp();
    await user.save();

    // Resend OTP email
    sendEmail(email, "Verify your account", `Your verification code is: ${otp}\nThis code expires in 10 minutes.`);

    res.send('A new OTP has been generated and sent to your email.');
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
};


// Login function
exports.login = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email }).select("+password");
    if (!user || !user.isActive) {
      return res.status(401).json({
        message: "Authentication failed. User not found or account not activated.",
      });
    }

    const isMatch = await bcrypt.compare(req.body.password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Authentication failed. Wrong password." });
    }

    const token = jwt.sign({ userId: user._id }, jwtSecret, { expiresIn: "1h" });

    // Initialize an empty object for studentDetails
    let studentDetailsData = null;

    // Fetch additional details if the user is a student
    if (user.role === "student") {
      studentDetailsData = await StudentDetails.findOne({ user: user._id });
      // Check if student details are not found
      if (!studentDetailsData) {
        return res.status(404).json({ message: "Student details not found." });
      }
    }

    // Return the token and user details
    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        studentDetails: studentDetailsData, // Include the student details
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error during login.", error: err.message });
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
      return res.status(404).json({ message: "User not found" });
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
    const updatedUser = await User.findByIdAndUpdate(userId, req.body, {
      new: true,
    });
    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
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
      return res.status(404).json({ message: "User not found" });
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
        { username: { $regex: searchPattern, $options: "i" } },
        { email: { $regex: searchPattern, $options: "i" } },
      ],
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
      return res.status(404).json({ message: "User not found" });
    }

    const token = user.generatePasswordResetToken(); // Utilize the new method
    await user.save(); // Save the user document to store the reset token and its expiration

    // Update to use HTTPS in production for the clientURL
    const resetUrl = `${clientURL}/reset-password/${token}`;

    // Assuming sendEmail is a function you've implemented to handle email sending
    await sendEmail({
      to: user.email,
      subject: "Password Reset Request",
      text: `To reset your password, please click on the following link: ${resetUrl}`,
    });

    res.status(200).json({ message: "Password reset email sent." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error sending password reset email." });
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
