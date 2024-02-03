const mongoose = require('mongoose');

// Schema for a single class
const classSchema = new mongoose.Schema({
  className: {
    type: String,
    required: true,
  },
  classCode: {
    type: String,
    unique: true,
    required: true,
  },
  // Add any other fields you need for the class
  // For example:
  instructor: {
    type: String,
  },
  room: {
    type: String,
  },
  // ... other class-related fields
});


module.exports = mongoose.model('Class', classSchema);
