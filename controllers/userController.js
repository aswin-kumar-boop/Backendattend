require("dotenv").config();
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const User = require("../models/user"); // Adjust the path according to your project structure
const jwt = require("jsonwebtoken");
//const { OAuth2Client } = require("google-auth-library");
const StudentDetails = require("../models/StudentDetails");
const { sendEmail } = require('../helpers/emailHelper');
const NFCData = require('../models/NFCData');
const BiometricData = require('../models/biometricData');


// // Environment variables
 const jwtSecret = process.env.JWT_SECRET;
// const emailUser = process.env.EMAIL_USER;
// const emailPass = process.env.EMAIL_PASS;
// const emailClientId = process.env.EMAIL_CLIENT_ID;
// const emailClientSecret = process.env.EMAIL_CLIENT_SECRET;
// const emailRefreshToken = process.env.EMAIL_REFRESH_TOKEN;
// const emailService = process.env.EMAIL_SERVICE; // For example, 'Gmail'
 const clientURL = process.env.CLIENT_URL; // Ensure this is HTTPS in production
 const saltRounds = parseInt(process.env.SALT_ROUNDS) || 10;

// // Email transport configuration using OAuth2 for Gmail
// const transporter = nodemailer.createTransport({
//   service: emailService,
//   auth: {
//     type: "OAuth2",
//     user: emailUser,
//     clientId: emailClientId,
//     clientSecret: emailClientSecret,
//     refreshToken: emailRefreshToken,
//   },
// });

// // Function to send OTP email
// const sendEmail = (email, subject, text) => {
//   const mailOptions = {
//     from: emailUser,
//     to: email,
//     subject: subject,
//     text: text,
//   };

//   transporter.sendMail(mailOptions, (error, info) => {
//     if (error) {
//       console.error("Error sending email:", error);
//     } else {
//       console.log("Email sent:", info.response);
//     }
//   });
// };

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
   
    if (!(user.otp === otp && user.otpExpires.getTime() > Date.now())) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }
    
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

    // Note: Fixed variable name for MongoDB ObjectId reference to match your schema
    const nfcDataInstance = new NFCData({
      studentob_Id: studentDetails._id, // Correctly reference the saved StudentDetails document
      studentId: studentId,
      tagId: "", // Placeholder or actual value as needed
    });

    await nfcDataInstance.save(); // Correctly call save on the instance

    const biometricDataInstance = new BiometricData({
      studentob_Id: studentDetails._id, // Correctly reference the saved StudentDetails document
      studentId: studentId,
      template: "" ,// Placeholder or actual value as needed
    });

    await biometricDataInstance.save(); // Correctly call save on the instance

    user.isActive = true;
    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    sendEmail(email, "Your Student ID", `Your unique student ID is: ${studentId}`);

    res.status(200).json({ message: "Account verified successfully." });
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
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(401).json({
        message: "Authentication failed. User not found.",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Authentication failed. Wrong password." });
    }

    // Assuming generateOtp() updates the user with a new OTP and its expiry time
    const otp = user.generateOtp(); // Ensure this method also saves the OTP and expiry time in the user document
    await user.save();

    // Send OTP email
    sendEmail(user.email, "Your OTP", `Your OTP is: ${otp}. It expires in 10 minutes.`);

    // Generate a temporary JWT token. This token might include a flag indicating it's for pre-verification
    const tempToken = jwt.sign(
      { userId: user._id, preVerification: true },
      jwtSecret,
      { expiresIn: "10m" } // Set expiration to match OTP validity
    );

    res.json({
      message: "OTP has been sent to your email.",
      tempToken: tempToken, // Send the temporary token to the user
    });
  } catch (err) {
    console.error("Error during login:", err);
    res.status(500).json({ message: "Error during login." });
  }
};


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

    // OTP is verified, so nullify the OTP fields to prevent reuse
    user.otp = null;
    user.otpExpires = null;
    await user.save();

    // Generate a JWT token for the user
    const token = jwt.sign({ userId: user._id }, jwtSecret, { expiresIn: "1h" });

    let studentDetailsData = null;
    let nfcDataInstance = null;
    let biometricDataInstance = null;

    // Proceed to fetch additional details if the user is a student
    if (user.role === "student") {
      studentDetailsData = await StudentDetails.findOne({ user: user._id });

      if (studentDetailsData) {
        // Fetch NFC and Biometric data using the ID from studentDetailsData
        nfcDataInstance = await NFCData.findOne({ studentob_Id: studentDetailsData._id });
        biometricDataInstance = await BiometricData.findOne({ studentob_Id: studentDetailsData._id });

        // Send an email to the user indicating successful login
        sendEmail(user.email, "Login Successful", "You have successfully logged in to your student dashboard.");
      } else {
        console.log("Student details not found for this user.");
      }
    }

    // Return the authentication token and user details, including any NFC and biometric data
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

    // First, find the associated StudentDetails document
    const studentDetails = await StudentDetails.findOneAndDelete({ user: userId });
    if (studentDetails) {
      // Use the ObjectId of the StudentDetails document to delete associated NFCData and BiometricData documents
      await Promise.all([
        NFCData.deleteMany({ studentob_Id: studentDetails._id }),
        BiometricData.deleteMany({ studentob_Id: studentDetails._id })
      ]);
      console.log('Associated student details, NFC data, and biometric data deleted successfully');
    } else {
      console.log('No associated student details found, or already deleted');
    }

    // Finally, delete the User document
    const deletedUser = await User.findByIdAndDelete(userId);
    if (!deletedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(204).send(); // Respond with a 204 status (No Content) for successful deletion
  } catch (err) {
    console.error("Error deleting user and associated data:", err);
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

    // Generate a password reset token
    const token = user.generatePasswordResetToken();
    await user.save();

    // Construct reset URL
    const resetUrl = `${clientURL}/reset-password/${token}`;

    // Send email with reset instructions
    await sendEmail( user.email, "Password Reset Request", `You are receiving this email because you (or someone else) have requested the reset of the password for your account.\n\nPlease click on the following link, or paste this into your browser to complete the process within one hour of receiving it:\n\n${resetUrl}\n\nIf you did not request this, please ignore this email and your password will remain unchanged.`
    );

    res.status(200).json({ message: "Password reset email sent." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error sending password reset email." });
  }
};

exports.verifyPassword = async (req, res) => {
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

    // Set the new password
    user.password = await bcrypt.hash(newPassword, saltRounds);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    // Log the user in (optional) or send a confirmation email
    res.status(200).json({ message: "Password has been updated." });
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
