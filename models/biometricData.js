const mongoose = require('mongoose');

const biometricDataSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StudentDetails',
    required: true
  },
  template: {
    type: String, // The type will depend on how you're encoding/storing the biometric data
    required: true,
    unique: true // Biometric data should be unique to each student
  },
  // Include additional fields as needed
}, { timestamps: true });

module.exports = mongoose.model('BiometricData', biometricDataSchema);
