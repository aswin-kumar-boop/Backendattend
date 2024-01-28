const mongoose = require('mongoose');

const studentDetailsSchema = new mongoose.Schema({
  studentId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  course: {
    type: String,
    required: true
  },
  year: {
    type: Number,
    required: true
  },
  section: {
    type: String,
    required: true
  },
  academicLevel: {
    type: Number,
    required: true
  },
  currentSemester: {
    type: String,
    required: false // Set to true if this field is mandatory
  },
  // Additional status field to track the approval state of the student
  status: {
    type: String,
    enum: ['pending_approval', 'approved', 'rejected'],
    default: 'pending_approval'
  },
  // You can add more fields as needed
}, { timestamps: true });

module.exports = mongoose.model('StudentDetails', studentDetailsSchema);
