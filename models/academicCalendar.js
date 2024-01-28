const mongoose = require('mongoose');

const academicCalendarSchema = new mongoose.Schema({
  year: {
    type: Number,
    required: true
  },
  semesters: [{
    name: {
      type: String,
      required: true
    },
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    },
    breaks: [{
      name: String,
      startDate: Date,
      endDate: Date
    }],
    holidays: [{
      name: String,
      date: Date
    }],
    specialEvents: [{
      name: String,
      description: String,
      date: Date
    }]
    // Any additional properties related to a semester can be nested here
  }]
  // Other global academic calendar events can be added outside the semesters array
});

const AcademicCalendar = mongoose.model('AcademicCalendar', academicCalendarSchema);

module.exports = AcademicCalendar;
