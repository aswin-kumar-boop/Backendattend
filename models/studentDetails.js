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
    required: false
  },
  status: {
    type: String,
    enum: ['pending_approval', 'approved', 'rejected'],
    default: 'pending_approval'
  },
  departmentName: {
    type: String,
    enum: ['Computer Engineering', 'Mechanical Engineering', 'Electrical Engineering', 'Civil Engineering', 'Chemical Engineering', 'Aerospace Engineering', 'Biomedical Engineering', 'Environmental Engineering', 'Industrial Engineering', 'Other'],
    required: false
  },
  department: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Department',
    required: false // Adjust based on your requirement
  },
  class: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Class',
    required: false // Adjust based on your requirement
  },
}, { timestamps: true });

module.exports = mongoose.model('StudentDetails', studentDetailsSchema);
