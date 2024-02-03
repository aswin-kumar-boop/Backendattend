const StudentDetails = require('../models/StudentDetails');
const NFCData = require('../models/NFCData');
const BiometricData = require('../models/biometricData');

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
