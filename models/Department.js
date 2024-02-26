const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
  departmentName: {
    type: String,
    enum: ['Computer Engineering', 'Mechanical Engineering', 'Electrical Engineering', 'Civil Engineering', 'Chemical Engineering', 'Aerospace Engineering', 'Biomedical Engineering', 'Environmental Engineering', 'Industrial Engineering', 'Other'], // Add other engineering departments as needed
    required: true
    },
  year: { 
    type: Number, 
    required: true 
    },
  headOfDepartment: {
    type: String,
    required: false
  },
  location: {
    type: String,
    required: false
  },
  contactEmail: {
    type: String,
    required: false
  },
  // Add more fields as needed
}, { timestamps: true });

module.exports = mongoose.model('Department', departmentSchema);
