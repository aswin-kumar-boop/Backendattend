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
  // department: { // Optional reference to Department model for faculty
  //   type: mongoose.Schema.Types.ObjectId,
  //   ref: 'Department',
  //   required: function() { return this.role === 'faculty'; } // Conditionally required if the user is a faculty member
  // },
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

// Method to generate an OTP for email verification
userSchema.methods.generateOtp = function() {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  this.otp = otp;
  // Set OTP to expire after 10 minutes
  this.otpExpires = new Date(Date.now() + 10*60000);
  return otp;
};

// Method to generate a password reset token
userSchema.methods.generatePasswordResetToken = function() {
  const resetToken = crypto.randomBytes(20).toString('hex');
  this.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  // Set the expiration to 1 hour from now
  this.resetPasswordExpires = Date.now() + 3600000; // 1 hour in milliseconds
  return resetToken;
};

// Index to automatically delete unverified users after 24 hours
userSchema.index({ "expiresAt": 1 }, { expireAfterSeconds: 0 });
// Existing methods here...

const User = mongoose.model('User', userSchema);

module.exports = User;
