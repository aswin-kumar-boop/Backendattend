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
    nfcCheckIn: Date,
    nfcCheckOut: Date,
    biometricCheckIn: {
        time: Date,
        isLate: Boolean
    },
    biometricCheckOut: Date,
    // New fields for exceptional circumstances
    exceptionalCircumstances: {
        type: Boolean,
        default: false
    },
    exceptionDuration: {
        type: Number, // Duration in hours
        default: 0
    },
    // You can continue to add additional fields as needed
}, { timestamps: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
