const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const crypto = require('crypto');

const userSchema = new Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    role: { 
      type: String,
       required: false,
        enum: ['student', 'faculty','admin'] },
    isActive: {
        type: Boolean,
        default: false
    },
    otp: {
        type: String,
        default: null
    },
    otpExpires: {
        type: Date,
        default: null
    },
    resetPasswordToken: {
        type: String,
        default: null
    },
    resetPasswordExpires: {
        type: Date,
        default: null
    },
    
}, {
    timestamps: true // Adds createdAt and updatedAt timestamps
});

// Method to generate an OTP for email verification
userSchema.methods.generateOtp = function() {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  this.otp = otp;
  // Set OTP to expire after 10 minutes
  this.otpExpires = Date.now() + 10*60*1000;

  return otp;
};

// Method to generate a password reset token
userSchema.methods.generatePasswordResetToken = function() {
  // Generate a random token
  const resetToken = crypto.randomBytes(20).toString('hex');

  // Hash the token and set to resetPasswordToken field
  this.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');

  // Set the expiration to 1 hour from now
  this.resetPasswordExpires = Date.now() + 3600000; // 1 hour in milliseconds

  return resetToken;
};


const User = mongoose.model('User', userSchema);

module.exports = User;
