const mongoose = require('mongoose');

// Schema for individual calendar events
const calendarEventSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    description: String,
    startDate: {
        type: Date,
        required: true
    },
    endDate: Date,
    allDay: {
        type: Boolean,
        default: true
    },
    eventType: {
        type: String,
        enum: ['holiday', 'termStart', 'termEnd', 'exam', 'event'],
        required: true
    }
}, { timestamps: true });

// Schema for the academic year calendar
const academicYearCalendarSchema = new mongoose.Schema({
    year: {
        type: Number,
        required: true
    },
    terms: [{
        termName: {
            type: String,
            required: true
        },
        termStart: {
            type: Date,
            required: true
        },
        termEnd: {
            type: Date,
            required: true
        }
    }],
    events: [calendarEventSchema]
}, { timestamps: true });

const AcademicCalendar = mongoose.model('AcademicCalendar', academicYearCalendarSchema);

module.exports = AcademicCalendar;
