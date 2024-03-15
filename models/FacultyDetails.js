const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Define the schema for faculty details
const facultyDetailsSchema = new Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // This should match the name of the user model
    required: true,
    unique: true // Ensure that each faculty detail is linked to a unique user
  },
  FacultyName: {
    type: String,
    required: false
  },
  department: {
    type: String,
    required: false // Mark as required
  },
  specialization: {
    type: String,
    required: false // Mark as required
  },
  officeHours: {
    type: String,
    required: false // Mark as required
  },
  officeLocation: {
    type: String,
    required: false // Mark as required
  },
  contactEmail: {
    type: String,
    required: false // Mark as required
  },
  contactPhone: {
    type: String,
    required: false // Mark as required
  },
  researchInterests: {
    type: [String],
    required: false, // The array itself is required,
    validate: [arrayLimit, '{PATH} requires at least one entry'] // Custom validator to ensure the array contains at least one string
  },
  // Any other specific fields relevant to faculty members can be added here
}, {
  timestamps: true // Adds createdAt and updatedAt fields automatically
});

// Custom validator function for the researchInterests array
function arrayLimit(val) {
  return val.length > 0;
}

// Create the model from the schema
const FacultyDetails = mongoose.model('FacultyDetails', facultyDetailsSchema);

module.exports = FacultyDetails;
