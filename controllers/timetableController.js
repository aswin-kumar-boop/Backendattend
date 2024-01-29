const Timetable = require('../models/Timetable');

// Controller methods for timetable component
exports.getTimetable = async (req, res) => {
    try {
      // Pagination logic can be added here if needed
      const timetable = await Timetable.find();
      res.json({ status: 'success', data: timetable });
    } catch (error) {
      console.error(error);
      res.status(500).json({ status: 'error', message: 'Server error' });
    }
  };
  
  exports.addSession = async (req, res) => {
    try {
      const { day, startTime, endTime, subject, sessionType } = req.body;
      const session = new Timetable({ day, startTime, endTime, subject, sessionType });
      await session.save();
      res.status(201).json({ status: 'success', message: 'Session added successfully', data: session });
    } catch (error) {
      console.error(error);
      res.status(500).json({ status: 'error', message: 'Server error' });
    }
  };

  exports.updateSession = async (req, res) => {
    try {
      const { id } = req.params; // Assuming the session ID is passed in the request parameters
      const { day, startTime, endTime, subject, sessionType } = req.body;
  
      // Find the session by ID
      const session = await Timetable.findById(id);
  
      if (!session) {
        return res.status(404).json({ status: 'error', message: 'Session not found' });
      }
  
      // Update session properties
      session.day = day;
      session.startTime = startTime;
      session.endTime = endTime;
      session.subject = subject;
      session.sessionType = sessionType;
  
      // Save the updated session
      await session.save();
  
      res.status(200).json({ status: 'success', message: 'Session updated successfully', data: session });
    } catch (error) {
      console.error(error);
      res.status(500).json({ status: 'error', message: 'Server error' });
    }
  };

  exports.deleteSession = async (req, res) => {
    try {
      const { id } = req.params; // Assuming the session ID is passed in the request parameters
  
      // Find the session by ID and delete it
      const deletedSession = await Timetable.findByIdAndRemove(id);
  
      if (!deletedSession) {
        return res.status(404).json({ status: 'error', message: 'Session not found' });
      }
  
      res.status(200).json({ status: 'success', message: 'Session deleted successfully', data: deletedSession });
    } catch (error) {
      console.error(error);
      res.status(500).json({ status: 'error', message: 'Server error' });
    }
  };