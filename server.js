require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const cron = require('node-cron');
const User = require('./models/user'); // Adjust the path to where your User model is defined


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
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*", // Adjust this to match your front-end URL for security
    methods: ["GET", "POST", "PUT"],
  },
});

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
  // cron.schedule('0 0 * * *', async () => {
  //   try {
  //     console.log('Running daily periodic check...');
  //     await performPeriodicCheck();
  //   } catch (error) {
  //     console.error('Error performing daily periodic check:', error);
  //   }
  // });

  // Schedule a task to run once a day at midnight to remove expired unverified users
  cron.schedule('0 * * * *', async () => { // Runs every hour
    try {
      // Setting the threshold to 24 hours ago
      const threshold = new Date(new Date() - 24 * 60 * 60 * 1000);
      console.log(`Deleting unverified users older than 24 hours`);
  
      // Find users to log them before deletion
      const usersToDelete = await User.find({ isVerified: false, createdAt: { $lt: threshold } }, '_id');
      console.log(`Found users to delete (older than 24 hours and unverified): ${usersToDelete.map(user => user._id).join(', ')}`);
      
      // Then delete them
      const deletionResult = await User.deleteMany({ _id: { $in: usersToDelete.map(user => user._id) } });
      console.log(`Expired unverified users removed. Count: ${deletionResult.deletedCount}`);
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
