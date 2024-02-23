const mongoose = require('mongoose');

// Define the Attendance schema
const attendanceSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StudentDetails', // Reference to the student details model
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  checkIns: [
    {
      time: {
        type: Date,
        required: true
      },
      status: {
        type: String,
        enum: ['OnTime', 'Late', 'VeryLate', 'Too Early'], // Include 'Too Early' in the enum
        required: true
      }
    }
  ],
  checkOuts: [
    {
      time: {
        type: Date,
        required: true
      },
      nfcTagId: String,
      biometricData: String,
      classDurationHours: Number
    }
  ],
  absences: [
    {
      sessionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Timetable',
        required: true
      },
      time: {
        type: Date,
        required: true
      }
    }
  ],
  status: {
    type: String,
    enum: ['Present', 'Late', 'Too Early', 'Absent', 'Irregular'],
    default: 'Absent'
  },
  exceptionalCircumstances: Boolean,
  exceptionDuration: {
    type: Number,
    default: 1
  }
});

// Create the Attendance model
const Attendance = mongoose.model('Attendance', attendanceSchema);

module.exports = Attendance;
