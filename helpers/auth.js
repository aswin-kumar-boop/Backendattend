const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const saltRounds = 10;


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

// Hash biometric data
const hashBiometricData = async (biometricData) => {
  try {
    const salt = await bcrypt.genSalt(saltRounds);
    const hash = await bcrypt.hash(biometricData, salt);
    return hash;
  } catch (error) {
    throw new Error('Error hashing biometric data');
  }
};

// Compare biometric data
const compareBiometricData = async (biometricData, hash) => {
  try {
    return await bcrypt.compare(biometricData, hash);
  } catch (error) {
    throw new Error('Error comparing biometric data');
  }
};
const authenticateToken = (req, res, next) => {
  // Get the token from the request header
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Authorization: Bearer TOKEN

  if (token == null) return res.sendStatus(401); // If no token, return unauthorized

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (err) return res.sendStatus(403); // If token is not valid, return forbidden
      req.user = user;
      next(); // Proceed to the next middleware or route handler
  });
};

module.exports = {
  hashPassword,
  comparePassword,
  generateToken,
  hashBiometricData,
  compareBiometricData,
  authenticateToken
};
