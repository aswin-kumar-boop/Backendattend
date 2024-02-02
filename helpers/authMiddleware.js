const jwt = require('jsonwebtoken');
const User = require('../models/user'); // Make sure to import your User model

exports.authMiddleware = async (req, res, next) => {
  try {
    // Get the token from the request header
    const token = req.headers.authorization.split(' ')[1]; // Assumes bearer token

    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET); // Use your secret from the environment variables

    // Find the user by their ID from the token
    const user = await User.findById(decoded.userId);

    // If no user is found, or the role is not 'staff'
    if (!user || user.role !== 'staff') {
      return res.status(403).json({ message: "You do not have permission to modify attendance records." });
    }

    // Attach user to request for further use in routes
    req.user = user;

    next(); // User is authenticated and authorized
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      // If the error thrown is because the JWT is unauthorized, return an unauthorized status
      return res.status(401).json({ message: "Unauthorized: Invalid token" });
    } else if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: "Unauthorized: Token has expired" });
    } else {
      // For other errors, return a generic server error
      res.status(500).json({ message: "Server error", error: err.message });
    }
  }
};
const checkAuthorization = (req, res, next) => {
  const userRole = req.user.role; // Assuming req.user is populated from a previous auth middleware
  if (!['staff', 'admin'].includes(userRole)) {
    return res.status(403).json({ message: "Unauthorized: You do not have permission to modify attendance records." });
  }
  next();
};

module.exports = { checkAuthorization };