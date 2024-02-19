// Controller method to get the timetable
const mongoose = require('mongoose');
const Class = require('../models/Class'); // Assuming you have a Class model
const Timetable = require('../models/Timetable'); // Assuming you have a Timetable model
const globalSettings = require('../config/globalSettings');

// Function to add a Class and then use its ID in a Timetable with duration validation
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

    // Validation for total session duration in a single day
    const sessionDays = sessions.map(session => session.day); // Get all session days
    const uniqueDays = [...new Set(sessionDays)]; // Get unique days

    let durationExceeded = false;
    uniqueDays.forEach(day => {
      const totalDuration = sessions.filter(session => session.day === day)
                                    .reduce((total, session) => total + (new Date(session.endTime) - new Date(session.startTime)) / (1000 * 60 * 60), 0);
      if (totalDuration > globalSettings.timetable.totalDuration) {
        durationExceeded = true;
      }
    });

    if (durationExceeded) {
      return res.status(400).json({
        status: 'error',
        message: `Total duration of sessions in a day cannot exceed ${globalSettings.timetable.TotalDuration} hours`
      });
    }

    // Now create a Timetable with this class
    const timetable = new Timetable({
      semester,
      year,
      classId: existingClass._id,
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
    const { semester, year, classId, session } = req.body; // Adjusted to add a single session, not multiple sessions

    // First, verify the class exists
    const existingClass = await Class.findById(classId);
    if (!existingClass) {
      return res.status(404).json({ status: 'error', message: 'Class not found' });
    }

    // Find the existing timetable for the class and day
    const existingTimetable = await Timetable.findOne({
      classId: classId,
      'sessions.day': session.day
    });

    // Calculate the total duration of sessions for that day
    const totalDuration = existingTimetable ? existingTimetable.sessions.reduce((total, sess) => {
      return sess.day === session.day ? total + (new Date(sess.endTime) - new Date(sess.startTime)) / (1000 * 60 * 60) : total;
    }, 0) : 0;

    // Check if the new session duration would exceed the daily limit
    const newSessionDuration = (new Date(session.endTime) - new Date(session.startTime)) / (1000 * 60 * 60);
    if (totalDuration + newSessionDuration > globalSettings.timetable.TotalDuration) {
      return res.status(400).json({
        status: 'error',
        message: `Adding this session would exceed the ${globalSettings.timetable.TotalDuration}-hour daily limit`
      });
    }

    // If the timetable doesn't exist, create it, otherwise add the session to it
    if (!existingTimetable) {
      const newTimetable = new Timetable({
        semester,
        year,
        classId,
        sessions: [session], // Start with the new session
        startDate: req.body.startDate, // Assuming these come from the request body
        endDate: req.body.endDate
      });
      await newTimetable.save();
      res.status(201).json({ status: 'success', message: 'Timetable created and session added successfully', data: newTimetable });
    } else {
      existingTimetable.sessions.push(session);
      await existingTimetable.save();
      res.status(201).json({ status: 'success', message: 'Session added successfully', data: existingTimetable });
    }
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
    const timetable = await Timetable.findOne({ '_id': timetableId });
    if (!timetable) {
      return res.status(404).json({ status: 'error', message: 'Timetable not found' });
    }

    // Find the session to update
    const sessionIndex = timetable.sessions.findIndex(session => session._id.toString() === sessionId);
    if (sessionIndex === -1) {
      return res.status(404).json({ status: 'error', message: 'Session not found' });
    }

    // Calculate the new total duration for the day after update
    let totalDuration = 0;
    timetable.sessions.forEach(session => {
      if (session.day === sessionUpdate.day) {
        if (session._id.toString() === sessionId) {
          // For the session being updated, use the new duration
          totalDuration += (new Date(sessionUpdate.endTime) - new Date(sessionUpdate.startTime)) / (1000 * 60 * 60);
        } else {
          // For all other sessions, use the existing duration
          totalDuration += (new Date(session.endTime) - new Date(session.startTime)) / (1000 * 60 * 60);
        }
      }
    });

    // Check if the updated duration exceeds the limit
    if (totalDuration > globalSettings.timetable.TotalDuration) {
      return res.status(400).json({
        status: 'error',
        message: `The updated sessions exceed the total allowed duration of ${globalSettings.timetable.TotalDuration} hours for the day`
      });
    }

    // If the duration is fine, update the session
    Object.assign(timetable.sessions[sessionIndex], sessionUpdate);
    await timetable.save();
    res.status(200).json({ status: 'success', message: 'Session updated successfully', data: timetable });
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

    // Find and remove the session from the sessions array
    const sessionIndex = timetable.sessions.findIndex(session => session._id.toString() === sessionId);
    if (sessionIndex === -1) {
      return res.status(404).json({ status: 'error', message: 'Session not found' });
    }

    // Remove the session
    timetable.sessions.splice(sessionIndex, 1);
    await timetable.save();

    res.status(200).json({ status: 'success', message: 'Session deleted successfully', data: timetable });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
};

exports.getWeeklyTimetable = async (req, res) => {
  try {
    const { classId } = req.params; // Assume classId is passed as a URL parameter

    // Find the timetable for the specified class
    const timetable = await Timetable.findOne({ classId: classId }).populate('sessions');
    if (!timetable) {
      return res.status(404).json({ status: 'error', message: 'Timetable not found' });
    }

    // Filter sessions for each weekday
    const weeklyTimetable = {
      MON: timetable.sessions.filter(session => session.day === 'MON'),
      TUE: timetable.sessions.filter(session => session.day === 'TUE'),
      WED: timetable.sessions.filter(session => session.day === 'WED'),
      THU: timetable.sessions.filter(session => session.day === 'THU'),
      FRI: timetable.sessions.filter(session => session.day === 'FRI'),
    };

    res.status(200).json({
      status: 'success',
      message: 'Weekly timetable fetched successfully',
      data: weeklyTimetable
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
};

