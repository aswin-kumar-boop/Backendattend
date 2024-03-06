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
  Class_instructor: {
    type: String,
    required: true,
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
    enum: ['Computer Engineering', 'Mechanical Engineering', 'Electrical Engineering', 'Civil Engineering', 'Chemical Engineering', 'Aerospace Engineering', 'Biomedical Engineering', 'Environmental Engineering', 'Industrial Engineering', 'Other'],
    required: true
  },
  year: { 
    type: Number, 
    required: true 
  },
  enrolledStudents: [{ 
    _id: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentDetails' },
    studentId: { type: String, required: true },
    name: { type: String, required: true }
  }],
});

// Virtual property to check if the class is full
classSchema.virtual('isFull').get(function () {
  return this.enrolledStudents.length >= 70;
});

module.exports = mongoose.model('Class', classSchema);
