require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const winston = require('winston'); // Optional, for logging
const http = require('http');
const socketIo = require('socket.io');

// Importing routes
const userRoutes = require('./routes/users');
const studentRoutes = require('./routes/studentRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const timetableRoutes = require('./routes/timetableRoutes');
const apiRoutes = require('./routes/api');
const analyticsRoutes = require('./routes/analyticsRoutes');
const settingsRouter = require('./routes/settings'); // Adjust the path as necessary


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
.then(() => console.log('MongoDB Connected'))
.catch(err => console.error('Failed to connect to MongoDB:', err));

// Setup routes
app.use('/api/users', userRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/timetable', timetableRoutes); 
app.use(express.json());

// Socket.IO for real-time updates
io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('joinRoom', (roomId) => {
    socket.join(roomId);
    console.log(`A user joined room: ${roomId}`);
  });

  socket.on('leaveRoom', (roomId) => {
    socket.leave(roomId);
    console.log(`A user left room: ${roomId}`);
  });

  socket.on('updateAttendance', (data) => {
    // Validate and process the data here
    // Then, broadcast the update to all clients in the room
    io.to(data.roomId).emit('attendanceUpdated', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something broke!', error: err.message });
});

// Start the server with Socket.IO
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
