const jwt = require('jsonwebtoken');
const User = require('../models/user'); // Make sure to import your User model

const checkAuthorization = (req, res, next) => {
  const userRole = req.user.role; // Assuming req.user is populated from a previous auth middleware
  if (!['staff', 'admin'].includes(userRole)) {
    return res.status(403).json({ message: "Unauthorized: You do not have permission to modify attendance records." });
  }
  next();
};

module.exports = { checkAuthorization };