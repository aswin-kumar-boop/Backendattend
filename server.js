require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const cron = require('node-cron');

// Importing routes
const userRoutes = require('./routes/users');
const studentRoutes = require('./routes/studentRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const timetableRoutes = require('./routes/timetableRoutes');
const apiRoutes = require('./routes/api');
const analyticsRoutes = require('./routes/analyticsRoutes');
const settingsRouter = require('./routes/settings'); // Adjust the path as necessary

// Importing controllers and utilities
const attendanceController = require('./controllers/attendanceController');
const performPeriodicCheck = require('./controllers/attendanceController').performPeriodicCheck;

const app = express();

// Middleware setup
app.use(cors());
app.use('/api', apiRoutes);
app.use(settingsRouter);
app.use(bodyParser.json());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, { 
  useNewUrlParser: true, 
  useUnifiedTopology: true,
})
.then(() => {
  console.log('MongoDB Connected');

  // Schedule the performPeriodicCheck function to run once a day at midnight
  cron.schedule('0 0 * * *', async () => {
    try {
      console.log('Running daily periodic check...');
      await performPeriodicCheck();
    } catch (error) {
      console.error('Error performing daily periodic check:', error);
    }
  });

  // Schedule a task to run once a day at midnight to remove expired unverified users
  cron.schedule('0 0 * * *', async () => {
    try {
      const threshold = new Date(new Date() - 24 * 60 * 60 * 1000); // 24 hours ago
      await User.deleteMany({ isVerified: false, createdAt: { $lt: threshold } });
      console.log('Expired unverified users removed.');
    } catch (error) {
      console.error('Error removing expired unverified users:', error);
    }
  });
})
.catch(err => console.error('Failed to connect to MongoDB:', err));

// Setup routes
app.use('/api/users', userRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/timetable', timetableRoutes); 
app.use(express.json());

// Additional setup for routes and socket.io...

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something broke!', error: err.message });
});

// Start the server with Socket.IO
const PORT = process.env.PORT || 4000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
