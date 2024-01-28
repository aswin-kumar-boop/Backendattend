const mongoose = require('mongoose');

// User schema definition
const UserSchema = new mongoose.Schema({
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
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
},
{
  timestamps: true // This adds createdAt and updatedAt timestamps automatically
});

// User model based on the schema
const User = mongoose.model('User', UserSchema);

module.exports = User;
