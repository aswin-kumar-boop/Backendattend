
const bcrypt = require('bcrypt');
const StudentDetails = require('../models/StudentDetails');
const NFCData = require('../models/NFCData');
const BiometricData = require('../models/biometricData');

// Middleware for validating and authenticating check-in data
exports.validateCheckInData = async (req, res, next) => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Retrieve necessary data from the request body
    const { studentId, nfcTagId, biometricData, exceptionalCircumstances, exceptionDuration } = req.body;

    // Fetch the student's details
    const student = await StudentDetails.findById(studentId);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    if (student.status !== 'approved') {
      return res.status(403).json({ message: 'Student not approved for check-in' });
    }

    // Validate NFC or biometric data
    let isValidNFC = !nfcTagId || await NFCData.exists({ studentId, tagId: nfcTagId });
    let isValidBiometric = await bcrypt.compare(biometricData, BiometricData.template);

    if (!isValidNFC && !isValidBiometric) {
      return res.status(400).json({ message: 'Invalid NFC or Biometric data' });
    }

    // Store the validated data in the request object for use in the route handler
    req.validatedCheckInData = {
      studentId,
      nfcTagId,
      biometricData,
      exceptionalCircumstances,
      exceptionDuration
    };

    next(); // Proceed to the route handler
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
