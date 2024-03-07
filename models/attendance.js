const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StudentDetails',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  checkIns: [
    {
      time: { type: Date, required: true },
      status: { type: String, enum: ['OnTime', 'Late', 'VeryLate', 'Too Early'], required: true },
      notes: { type: String, required: false } // Optional field for notes
    }
  ],
  checkOuts: [
    {
      time: { type: Date, required: true },
      nfcTagId: String,
      biometricData: String,
      classDurationHours: Number,
      sessionStatus: { type: String, enum: ['Completed', 'LeftEarly'], default: 'Completed' } // New field to capture session completion status
    }
  ],
  absences: [
    {
      sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Timetable', required: true },
      time: { type: Date, required: true }
    }
  ],
  status: {
    type: String,
    enum: ['Present', 'Late', 'Too Early', 'Absent', 'Irregular'],
    default: 'Absent'
  },
  exceptionalCircumstances: { type: Boolean, default: false },
  exceptionDuration: { type: Number, default: 1 } // Represents the duration of the exception in days
});

const Attendance = mongoose.model('Attendance', attendanceSchema);

module.exports = Attendance;
