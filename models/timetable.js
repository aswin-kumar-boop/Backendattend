const mongoose = require('mongoose');

// Schema for a single class session
const classSessionSchema = new mongoose.Schema({
    subject: {
        type: String,
        required: true
    },
    teacher: {
        type: String,
        required: true
    },
    startTime: {
        type: Date,
        required: true
    },
    endTime: {
        type: Date,
        required: true
    },
    sessionType: { // New field to differentiate between lecture, lab, etc.
        type: String,
        required: true,
        enum: ['lecture', 'lab', 'seminar', 'workshop'], // etc.
    },
    duration: { // New field to capture the duration of the session
        type: Number, // In hours
        required: true
    },
    // You can add more fields as needed, like room number, class capacity, etc.
});

// Schema for the timetable
const timetableSchema = new mongoose.Schema({
    semester: { // New field to identify the semester
        type: Number,
        required: true
    },
    year: { // New field to identify the academic year
        type: Number,
        required: true
    },
    classId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class', // Assuming you have a Class model
        required: true
    },
    sessions: [classSessionSchema], // Array of class sessions
    // Additional fields can be added as necessary
});

const Timetable = mongoose.model('Timetable', timetableSchema);

module.exports = Timetable;
