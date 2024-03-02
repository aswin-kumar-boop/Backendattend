// Import required modules and libraries
const dotenv = require("dotenv");
dotenv.config();
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const StudentDetails = require("../models/StudentDetails");
const { sendEmail } = require('../helpers/emailHelper');
const NFCData = require('../models/NFCData');
const BiometricData = require('../models/biometricData');

// Environment variables
const jwtSecret = process.env.JWT_SECRET;
const clientURL = process.env.CLIENT_URL;
const saltRounds = parseInt(process.env.SALT_ROUNDS) || 10;

// Registration function with OTP
exports.register = async (req, res) => {
  try {
    const { username, email, password, role } = req.body;

    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      if (!existingUser.isVerified) {
        const otp = existingUser.generateOtp();
        await existingUser.save();
        sendEmail(email, "Verify your account", `Your verification code is: ${otp}\nThis code expires in 10 minutes.`);
        return res.status(201).json({
          success: true,
          message: "User already registered. Please verify your account with the OTP sent to your email.",
        });
      }
      return res.status(400).json({ message: "User already exists." });
    }

    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      role,
      department: departmentId, // Assuming the User model has a 'department' field for faculty
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

      let message = "Account verified successfully.";

      // Check if the user is a student
      if (user.role === 'student') {
          const studentId = await generateStudentId();

          const studentDetails = await new StudentDetails({
              user: user._id,
              studentId,
              name: "",
              course: "",
              year: 0,
              section: "",
              academicLevel: "",
              currentSemester: "",
              status: 'pending_approval',
          }).save();

          const uniqueNfcTagId = `NFC-${user._id}-${Date.now()}`;
          const uniqueBiometricTemplate = `BIO-${user._id}-${Date.now()}`;

          const nfcDataInstance = new NFCData({
              studentob_Id: studentDetails._id,
              studentId: studentId,
              tagId: uniqueNfcTagId,
          });

          await nfcDataInstance.save();

          const biometricDataInstance = new BiometricData({
              studentob_Id: studentDetails._id,
              studentId: studentId,
              template: uniqueBiometricTemplate,
          });

          await biometricDataInstance.save();

          message += ` Your unique student ID is: ${studentId}`;
      }

      user.isActive = true;
      user.isVerified = true;
      user.otp = undefined;
      user.otpExpires = undefined;
      await user.save();

      sendEmail(email, "Your Account Verification", message);

      res.status(200).json({
          success: true,
          message: message
      });
  } catch (err) {
      console.error("Error verifying OTP:", err);
      res.status(500).json({ message: "Error verifying OTP." });
  }
};

// Endpoint to regenerate OTP
exports.regenerateotp = async (req, res) => {
  const { email } = req.body;
  try {
    let user = await User.findOne({ email });
    if (!user) return res.status(404).send('User not found');

    if (user.isActive) return res.status(400).send('Account already verified. OTP regeneration not allowed.');

    const otp = user.generateOtp();
    await user.save();

    sendEmail(email, "Verify your account", `Your verification code is: ${otp}\nThis code expires in 10 minutes.`);

    res.send('A new OTP has been generated and sent to your email.');
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
};

// Login function
// Login function
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(401).json({
        message: "Authentication failed. User not found.",
      });
    }

    if (!password) {
      return res.status(400).json({
        message: "Authentication failed. Password is required.",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Authentication failed. Wrong password." });
    }

    // Fetch department and year information based on the user's role
    const { departmentName, year } = await fetchDepartmentAndYear(email);

    const otp = user.generateOtp();
    await user.save();

    sendEmail(user.email, "Your OTP", `Your OTP is: ${otp}. It expires in 10 minutes.`);

    const tempToken = jwt.sign(
      { userId: user._id, preVerification: true, departmentName, year },
      jwtSecret,
      { expiresIn: "10m" }
    );

    res.json({
      message: "OTP has been sent to your email.",
      tempToken: tempToken,
      departmentName,
      year
    });
  } catch (err) {
    console.error("Error during login:", err);
    res.status(500).json({ message: "Error during login." });
  }
};

const fetchDepartmentAndYear = async (email) => {
  try {
    // Assuming you have a User model that contains departmentName and year fields
    const user = await User.findOne({ email }).select("departmentName year");
    if (!user) {
      throw new Error("User not found");
    }

    const { departmentName, year } = user;
    return { departmentName, year };
  } catch (error) {
    console.error("Error fetching department and year:", error);
    throw error;
  }
};



// OTP verification after login
exports.LoginVerify = async (req, res) => {
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

    user.otp = null;
    user.otpExpires = null;
    await user.save();

    const token = jwt.sign({ userId: user._id }, jwtSecret, { expiresIn: "1h" });

    let studentDetailsData = null;
    let nfcDataInstance = null;
    let biometricDataInstance = null;

    if (user.role === "student") {
      studentDetailsData = await StudentDetails.findOne({ user: user._id });

      if (studentDetailsData) {
        nfcDataInstance = await NFCData.findOne({ studentob_Id: studentDetailsData._id });
        biometricDataInstance = await BiometricData.findOne({ studentob_Id: studentDetailsData._id });

        sendEmail(user.email, "Login Successful", "You have successfully logged in to your student dashboard.");
      } else {
        console.log("Student details not found for this user.");
      }
    }

    res.json({
      success: true,
      message: "OTP verified successfully. Welcome to your dashboard.",
      token: token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        studentDetails: studentDetailsData,
        nfcData: nfcDataInstance,
        biometricData: biometricDataInstance,
      },
    });
  } catch (err) {
    console.error("Error during OTP verification:", err);
    res.status(500).json({ message: "Error during OTP verification." });
  }
};

// Function to get a single user by ID with associated NFC and biometric data
// Function to get a single user by ID with associated NFC and biometric data
exports.getUserById = async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Fetch associated student details
    const studentDetails = await StudentDetails.findOne({ user: userId });
    let nfcData = null;
    let biometricData = null;

    if (studentDetails) {
      // Fetch associated NFC data
      nfcData = await NFCData.findOne({ studentob_Id: studentDetails._id });

      // Fetch associated biometric data
      biometricData = await BiometricData.findOne({ studentob_Id: studentDetails._id });
    }

    // Construct the response object with user, student details, NFC data, and biometric data
    const userData = {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
      studentDetails: studentDetails,
      nfcData: nfcData,
      biometricData: biometricData,
    };

    res.json(userData);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Function to get all users with associated NFC and biometric data
// Function to get all users with associated NFC and biometric data
exports.getAllUsers = async (req, res) => {
  try {
    // Fetch all users
    const users = await User.find();

    // Fetch associated data for each user
    const userData = await Promise.all(users.map(async (user) => {
      // Fetch associated student details
      const studentDetails = await StudentDetails.findOne({ user: user._id });

      // Initialize variables for NFC data and biometric data
      let nfcData = null;
      let biometricData = null;

      // If student details exist, fetch associated NFC data and biometric data
      if (studentDetails) {
        nfcData = await NFCData.findOne({ studentob_Id: studentDetails._id });
        biometricData = await BiometricData.findOne({ studentob_Id: studentDetails._id });
      }

      // Return user object with associated data
      return {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
        studentDetails: studentDetails,
        nfcData: nfcData,
        biometricData: biometricData,
      };
    }));

    res.json(userData);
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

    const studentDetails = await StudentDetails.findOneAndDelete({ user: userId });
    if (studentDetails) {
      await Promise.all([
        NFCData.deleteMany({ studentob_Id: studentDetails._id }),
        BiometricData.deleteMany({ studentob_Id: studentDetails._id })
      ]);
      console.log('Associated student details, NFC data, and biometric data deleted successfully');
    } else {
      console.log('No associated student details found, or already deleted');
    }

    const deletedUser = await User.findByIdAndDelete(userId);
    if (!deletedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(204).send();
  } catch (err) {
    console.error("Error deleting user and associated data:", err);
    res.status(500).json({ message: err.message });
  }
};

// Function to search for users by username or email
exports.searchUsers = async (req, res) => {
  try {
    const searchPattern = req.body.search;

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

// Forgot Password Function
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const token = user.generatePasswordResetToken();
    await user.save();

    const resetUrl = `${clientURL}/reset-password/${token}`;

    sendEmail(user.email, "Password Reset Request", `You are receiving this email because you (or someone else) have requested the reset of the password for your account.\n\nPlease click on the following link, or paste this into your browser to complete the process within one hour of receiving it:\n\n${resetUrl}\n\nIf you did not request this, please ignore this email and your password will remain unchanged.`
    );

    res.status(200).json({ message: "Password reset email sent." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error sending password reset email." });
  }
};

// Function to reset password
// Function to reset password
exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword, confirmNewPassword } = req.body;

    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({ message: "Passwords do not match." });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: "Password reset token is invalid or has expired." });
    }

    user.password = await bcrypt.hash(newPassword, saltRounds);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    // Send email to user upon successful password reset
     sendEmail(user.email, "Password Reset Successful", "Your password has been successfully reset.");

    res.status(200).json({ message: "Password has been updated. You will receive an email confirmation shortly." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error resetting password." });
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
