const mongoose = require("mongoose");

// Schema for a single class session
const classSessionSchema = new mongoose.Schema({
  day: {
    type: String,
    enum: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
    required: true,
  },
  startTime: {
    type: Date,
    required: true,
  },
  endTime: {
    type: Date,
    required: true,
  },
  subject: {
    type: String,
    required: true,
  },
  subject_instructor: {
    type: String,
    required: true,
  },
  sessionType: {
    type: String,
    enum: ["LECTURE", "LAB"],
    required: true,
  },
  // ... you can add additional fields as needed, such as instructor, room, etc.
});

// Schema for the timetable
const timetableSchema = new mongoose.Schema({
  semester: {
    type: Number,
    required: false,
  },
  year: {
    type: Number,
    required: true,
  },
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Class", // Assuming you have a Class model
    required: true,
  },
  sessions: [classSessionSchema], // Array of class sessions
  startDate: {
    type: Date, // Semester start date
    required: false,
  },
  endDate: {
    type: Date, // Semester end date
    required: false,
  },
  // Add any other fields you need for the timetable
});

const Timetable = mongoose.model("Timetable", timetableSchema);

module.exports = Timetable;
