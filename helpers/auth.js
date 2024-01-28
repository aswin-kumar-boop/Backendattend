const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const saltRounds = 10;
const jwtSecret = 'your_jwt_secret'; // This should be in an environment variable

// Hash Password
const hashPassword = async (password) => {
  try {
    const salt = await bcrypt.genSalt(saltRounds);
    const hash = await bcrypt.hash(password, salt);
    return hash;
  } catch (error) {
    // Handle the error, e.g., log it or throw a custom error
    throw new Error('Error hashing password');
  }
};

// Compare Password
const comparePassword = async (password, hash) => {
  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    // Handle the error, e.g., log it or throw a custom error
    throw new Error('Error comparing passwords');
  }
};

// Generate JWT Token
const generateToken = (user) => {
  const { _id, username, email } = user;
  const payload = {
    user: {
      id: _id,
      username,
      email
    }
  };

  try {
    return jwt.sign(payload, jwtSecret, { expiresIn: '1h' }); // Token expires in 1 hour
  } catch (error) {
    // Handle the error, e.g., log it or throw a custom error
    throw new Error('Error generating JWT token');
  }
};

module.exports = {
  hashPassword,
  comparePassword,
  generateToken
};
