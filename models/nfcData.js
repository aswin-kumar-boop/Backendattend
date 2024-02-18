const mongoose = require('mongoose');

const nfcDataSchema = new mongoose.Schema({
  studentob_Id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StudentDetails',
    required: true
  },
  studentId: {
    type: String,
    required: false,
    unique: true
  },
  tagId: {
    type: String,
    required: false,
    unique: true // Depending on whether a tag can be associated with multiple students or not
  },
  // Include additional fields as needed
}, { timestamps: true });

module.exports = mongoose.model('NFCData', nfcDataSchema);
