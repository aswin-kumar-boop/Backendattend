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
        enum: ['OnTime', 'Late', 'VeryLate'],
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
      nfcTagId: String, // You can adjust this based on your data
      biometricData: String, // You can adjust this based on your data
      classDurationHours: Number // Save class duration in hours
    }
  ],
  absences: [
    {
      sessionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Timetable', // Reference to the timetable model
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
    enum: ['Present', 'Late', 'Absent', 'Irregular'],
    default: 'Absent' // Default status
  },
  exceptionalCircumstances: Boolean,
  exceptionDuration: {
    type: Number,
    default: 1 // Default duration in hours for exceptional circumstances
  }
});

// Create the Attendance model
const Attendance = mongoose.model('Attendance', attendanceSchema);

module.exports = Attendance;
