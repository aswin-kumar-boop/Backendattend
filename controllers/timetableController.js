// Controller method to get the timetable
const mongoose = require('mongoose');
const Class = require('../models/Class'); // Assuming you have a Class model
const Timetable = require('../models/Timetable'); // Assuming you have a Timetable model

// Function to add a Class and then use its ID in a Timetable
exports.addClassWithTimetable = async (req, res) => {
  try {
    // Extract class details from request
    const { className, classCode, instructor, room } = req.body.classDetails;
    const { semester, year, sessions, startDate, endDate } = req.body.timetableDetails;

    // Check if class already exists to avoid duplicate class codes
    let existingClass = await Class.findOne({ classCode: classCode });
    if (!existingClass) {
      // If class doesn't exist, create a new one
      existingClass = new Class({ className, classCode, instructor, room });
      await existingClass.save();
    }

    // Now create a Timetable with this class
    const timetable = new Timetable({
      semester,
      year,
      classId: existingClass._id, // Reference to the Class
      sessions,
      startDate,
      endDate
    });

    await timetable.save();

    // Populate the 'classId' to return the class details along with the timetable
    await timetable.populate('classId', 'className classCode instructor room');

    res.status(201).json({
      status: 'success',
      message: 'Class and Timetable added successfully',
      data: timetable
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
};


// Controller method to add a session to a specific class in the timetable
exports.addSession = async (req, res) => {
  try {
    const { semester, year, classId, sessions, startDate, endDate } = req.body;
    // First, verify the class exists
    const existingClass = await Class.findById(classId);
    if (!existingClass) {
      return res.status(404).json({ status: 'error', message: 'Class not found' });
    }

    // Then, create or update the timetable
    const timetable = new Timetable({ semester, year, classId, sessions, startDate, endDate });
    await timetable.save();
    res.status(201).json({ status: 'success', message: 'Session added successfully', data: timetable });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
};

// Controller method to update a session in the timetable
exports.updateSession = async (req, res) => {
  try {
    const { timetableId, sessionId } = req.params; // Assuming these are passed in the request parameters
    const sessionUpdate = req.body; // The updates for the session

    // Find the timetable and update the specific session
    const timetable = await Timetable.findOne({ '_id': timetableId, 'sessions._id': sessionId });
    if (!timetable) {
      return res.status(404).json({ status: 'error', message: 'Timetable or session not found' });
    }

    // Update the specific session within the timetable
    const sessionIndex = timetable.sessions.findIndex(session => session._id.toString() === sessionId);
    if (sessionIndex > -1) {
      Object.assign(timetable.sessions[sessionIndex], sessionUpdate);
      await timetable.save();
      res.status(200).json({ status: 'success', message: 'Session updated successfully', data: timetable });
    } else {
      res.status(404).json({ status: 'error', message: 'Session not found' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
};

// Controller method to delete a session from the timetable
exports.deleteSession = async (req, res) => {
  try {
    const { timetableId, sessionId } = req.params; // Assuming these are passed in the request parameters

    // Find the timetable and remove the specific session
    const timetable = await Timetable.findById(timetableId);
    if (!timetable) {
      return res.status(404).json({ status: 'error', message: 'Timetable not found' });
    }

    const updatedSessions = timetable.sessions.filter(session => session._id.toString() !== sessionId);
    timetable.sessions = updatedSessions;
    await timetable.save();

    res.status(200).json({ status: 'success', message: 'Session deleted successfully', data: timetable });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
};
