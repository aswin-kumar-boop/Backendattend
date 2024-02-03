const { body, validationResult } = require('express-validator');

// Middleware to check if a student exists by ID
async function checkStudentExists(req, res, next) {
    const studentId = req.params.id;
    try {
        const student = await StudentDetails.findById(studentId);
        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }
        req.student = student; // Attach student to request
        next();
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
}

// Middleware for input validation when registering a new student
exports.validateRegistration = [
    body('name').isString().notEmpty(),
    body('email').isEmail(),
    // Add more validation rules for other fields as needed
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    }
];

// Middleware for input validation when updating student status
exports.validateUpdateStatus = [
    body('status').isIn(['approved', 'rejected']).notEmpty(),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    }
];

// Middleware for input validation when submitting NFC data
exports.validateSubmitNFCData = [
    body('studentId').isMongoId().notEmpty(),
    body('nfcTagId').isString().notEmpty(),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    }
];

// Middleware for input validation when submitting biometric data
exports.validateSubmitBiometricData = [
    body('studentId').isMongoId().notEmpty(),
    body('template').isString().notEmpty(),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    }
];
