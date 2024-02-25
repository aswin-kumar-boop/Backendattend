const mongoose = require('mongoose');

// Schema for a single class
const classSchema = new mongoose.Schema({
  className: {
    type: String,
    required: true,
  },
  classCode: {
    type: String,
    unique: true,
    required: true,
  },
  instructor: {
    type: String,
  },
  room: {
    type: String,
  },
  department: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Department', 
    required: true 
  },
  departmentName: {
    type: String,
    enum: ['Computer Engineering', 'Mechanical Engineering', 'Electrical Engineering', 'Civil Engineering', 'Chemical Engineering', 'Aerospace Engineering', 'Biomedical Engineering', 'Environmental Engineering', 'Industrial Engineering', 'Other'], // Add other engineering departments as needed
    required: true
  },
  year: { 
    type: Number, 
    required: true 
  },
  enrolledStudents: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'StudentDetails' 
  }],
  // Ensure there's a limit to the number of enrolled students
});

// Virtual property to check if the class is full
classSchema.virtual('isFull').get(function () {
  return this.enrolledStudents.length >= 70;
});

module.exports = mongoose.model('Class', classSchema);
