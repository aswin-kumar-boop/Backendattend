const mongoose = require('mongoose');

const studentDetailsSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: true,
    ref: 'User' 
  },
  studentId: {
    type: String,
    required: false,
    unique: true
  },
  name: {
    type: String,
    required: false
  },
  course: {
    type: String,
    required: false
  },
  year: {
    type: Number,
    required: false
  },
  section: {
    type: String,
    required: false
  },
  academicLevel: {
    type: String,
    required: false
  },
  currentSemester: {
    type: String,
    required: false // Adjust based on whether this field is mandatory
  },
  status: {
    type: String,
    enum: ['pending_approval', 'approved', 'rejected'],
    default: 'pending_approval'
  },
  departmentName: {
    type: String,
    enum: ['Computer Engineering', 'Mechanical Engineering', 'Electrical Engineering', 'Civil Engineering', 'Chemical Engineering', 'Aerospace Engineering', 'Biomedical Engineering', 'Environmental Engineering', 'Industrial Engineering', 'Other'], // Add other engineering departments as needed
    required: false
  },
  // Field to store the URL or path to the student's photo
  // photoUrl: {
  //   type: String,
  //   required: false // Set to true if you require a photo for each student
  // },
  // You can add more fields as needed
}, { timestamps: true });

module.exports = mongoose.model('StudentDetails', studentDetailsSchema);
