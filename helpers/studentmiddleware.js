const StudentDetails = require('../models/StudentDetails');
const NFCData = require('../models/NFCData');
const BiometricData = require('../models/biometricData');
const User = require('../models/user'); 

const jwt = require('jsonwebtoken');

exports.AuthMiddleware = async (req, res, next) => {
    try {
      // Get the token from the request header
      const token = req.headers.authorization.split(' ')[1]; // Assumes bearer token
  
      // Verify the token
      const decoded = jwt.verify(token, process.env.JWT_SECRET); // Use your secret from the environment variables
  
      // Find the user by their ID from the token
      const user = await User.findById(decoded.userId);
 
      // Attach user to request for further use in routes
      req.user = user;
  
      next(); // User is authenticated and authorized
    } catch (err) {
      if (err.name === 'JsonWebTokenError') {
        // If the error thrown is because the JWT is unauthorized, return an unauthorized status
        return res.status(401).json({ message: "Unauthorized: Invalid token" });
      } else if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ message: "Unauthorized: Token has expired" });
      } else {
        // For other errors, return a generic server error
        res.status(500).json({ message: "Server error", error: err.message });
      }
    }
  };

// Middleware to check if a student exists by ID
exports.checkStudentExistence = async (req, res, next) => {
    try {
        const studentId = req.params.id;
        const student = await StudentDetails.findById(studentId);
        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }
        req.student = student; // Attach the student object to the request for later use
        next();
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Middleware to check if a student is pending approval
exports.checkPendingApprovalStatus = (req, res, next) => {
    const student = req.student;
    if (student.status === 'pending_approval') {
        next();
    } else {
        return res.status(403).json({ message: 'Student cannot be rejected or deleted' });
    }
};

// Middleware to delete student-related data (NFC and biometric data)
exports.deleteStudentData = async (req, res, next) => {
    try {
        const studentId = req.student._id;

        // Delete student's NFC data (you may add more data deletion if needed)
        await NFCData.deleteMany({ studentId });

        // Delete student's biometric data (you may add more data deletion if needed)
        await BiometricData.deleteMany({ studentId });

        next();
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = exports;
