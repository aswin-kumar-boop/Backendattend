const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const attendanceSchema = new Schema({
  studentId: {
    type: Schema.Types.ObjectId,
    ref: 'StudentDetails', // Ensure this matches your Student model's name
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  checkIns: [
    {
      sessionId: {
        type: Schema.Types.ObjectId,
        ref: 'Timetable.sessions', // Adjust based on your actual Session model or reference
        required: true
      },
      time: { type: Date, required: true },
      status: { type: String, enum: ['On Time', 'Late', 'VeryLate', 'Too Early', 'Early'], required: true },
      notes: { type: String, required: false } // Optional field for notes
    }
  ],
  checkOuts: [
    {
      sessionId: {
        type: Schema.Types.ObjectId,
        ref: 'Timetable.sessions', // Ensure this aligns with your session references
        required: true
      },
      time: { type: Date, required: true },
      nfcTagId: String, // Optional, depending on your use case
      biometricData: String, // Consider encryption and privacy laws
      classDurationHours: Number, // Calculated or provided duration of the class
      sessionStatus: { type: String, enum: ['Completed', 'LeftEarly'], default: 'Completed' }
    }
  ],
  absences: [
    {
      sessionId: { type: Schema.Types.ObjectId, ref: 'Timetable.sessions', required: true }, // Adjust as needed
      time: { type: Date, required: true }
    }
  ],
  status: {
    type: String,
    enum: ['Present', 'Late', 'Too Early', 'Absent', 'Irregular'],
    default: 'Absent'
  },
  exceptionalCircumstances: { type: Boolean, default: false },
  exceptionDuration: { type: Number, default: 1 } // Represents the duration of the exception in days, adjust as necessary
});

const Attendance = mongoose.model('Attendance', attendanceSchema);

module.exports = Attendance;
