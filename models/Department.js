const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
  departmentName: {
    type: String,
    enum: ['Computer Engineering', 'Mechanical Engineering', 'Electrical Engineering', 'Civil Engineering', 'Chemical Engineering', 'Aerospace Engineering', 'Biomedical Engineering', 'Environmental Engineering', 'Industrial Engineering', 'Other'],
    required: true
  },
  year: { 
    type: Number, 
    required: true 
  },
  headOfDepartment: {
    type: mongoose.Schema.Types.ObjectId, // Reference to User model
    ref: 'User',
    required: false
  },
  facultyMembers: [{
    type: mongoose.Schema.Types.ObjectId, // Reference to User model for faculty members
    ref: 'User'
  }],
  location: {
    type: String,
    required: false
  },
  contactEmail: {
    type: String,
    required: false
  },
  classes: [{
    type: mongoose.Schema.Types.ObjectId, // Reference to Class model
    ref: 'Class'
  }]
}, { timestamps: true });

module.exports = mongoose.model('Department', departmentSchema);
