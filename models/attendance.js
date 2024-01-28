const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'StudentDetails', // Ensure this matches your student details model
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    nfcCheckIn: Date,
    nfcCheckOut: Date,
    biometricCheckIn: {
        time: Date,
        isLate: Boolean
    },
    biometricCheckOut: Date,
    // Additional fields can be added here if necessary
}, { timestamps: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
