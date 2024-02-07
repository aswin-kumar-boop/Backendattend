const mongoose = require('mongoose');

const studentDetailsSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId,
     ref: 'user', 
     required: true
     },
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
    required: false // Adjust based on whether this field is mandatory
  },
  status: {
    type: String,
    enum: ['pending_approval', 'approved', 'rejected'],
    default: 'pending_approval'
  },
  // Field to store the URL or path to the student's photo
  photoUrl: {
    type: String,
    required: false // Set to true if you require a photo for each student
  },
  // You can add more fields as needed
}, { timestamps: true });

module.exports = mongoose.model('StudentDetails', studentDetailsSchema);
