const mongoose = require('mongoose');
const crypto = require('crypto');
const Schema = mongoose.Schema;

const userSchema = new Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['student', 'faculty', 'admin'],
  },
  department: { // Optional reference to Department model for faculty
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: function() { return this.role === 'faculty'; } // Conditionally required if the user is a faculty member
  },
  isActive: {
    type: Boolean,
    default: false,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  otp: {
    type: String,
    default: null,
  },
  otpExpires: {
    type: Date,
    default: null,
  },
  expiresAt: {
    type: Date,
    default: () => Date.now() + 24*60*60*1000, // 24 hours from now
  },
  resetPasswordToken: {
    type: String,
    default: null,
  },
  resetPasswordExpires: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true, // Adds createdAt and updatedAt timestamps
});

// Existing methods here...

const User = mongoose.model('User', userSchema);

module.exports = User;
