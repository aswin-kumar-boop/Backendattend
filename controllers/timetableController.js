// Controller method to get the timetable
const mongoose = require('mongoose');
const Class = require('../models/Class'); // Assuming you have a Class model
const Timetable = require('../models/Timetable'); // Assuming you have a Timetable model
const Department = require('../models/Department'); 
const globalSettings = require('../config/globalSettings');

// Function to add a Class and then use its ID in a Timetable with duration validation
// Simplified function to add a class and its timetable
// Function to add a Class and then use its ID in a Timetable with duration validation
exports.addClassWithTimetable = async (req, res) => {
  try {
    const { className, classCode, Class_instructor, room, departmentName, year } = req.body.classDetails;
    const { semester, sessions, startDate, endDate } = req.body.timetableDetails;

    let department = await Department.findOne({ departmentName: departmentName, year: year });
    if (!department) {
      department = new Department({ departmentName, year });
      await department.save();
    }

    let existingClass = await Class.findOne({ classCode: classCode });
    if (!existingClass) {
      existingClass = new Class({
        className,
        classCode,
        Class_instructor,
        room,
        department: department._id,
        departmentName,
        year
      });
      await existingClass.save();
    }

    // Duration validation logic remains unchanged

    const timetable = new Timetable({
      semester,
      year,
      classId: existingClass._id,
      sessions,
      startDate,
      endDate
    });
    await timetable.save();
    await timetable.populate('classId', 'className classCode Class_instructor room');

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
// Simplified function to add a session to a class timetable
exports.addSession = async (req, res) => {
  try {
    const { semester, year, session, classDetails, startDate, endDate } = req.body;
    const { className, classCode } = classDetails;

    // Find the class by className or classCode
    const existingClass = await Class.findOne({ 
      $or: [{ className: className }, { classCode: classCode }] 
    });
    
    if (!existingClass) {
      return res.status(404).json({ status: 'error', message: 'Class not found' });
    }

    const classId = existingClass._id;

    // Attempt to find an existing timetable for this class for the given semester and year
    let timetable = await Timetable.findOne({ classId, semester, year });

    // Calculate the duration of the new session
    const newSessionDuration = (new Date(session.endTime) - new Date(session.startTime)) / (3600000); // Convert ms to hours

    // If a timetable exists, calculate the total session duration for the new session's day to ensure it doesn't exceed the limit
    if (timetable) {
      const totalDurationOnDay = timetable.sessions.filter(s => s.day === session.day)
          .reduce((total, currentSession) => total + ((new Date(currentSession.endTime) - new Date(currentSession.startTime)) / (3600000)), 0);

      if (totalDurationOnDay + newSessionDuration > globalSettings.timetable.TotalDuration) {
          return res.status(400).json({
              status: 'error',
              message: `Adding this session exceeds the daily limit of ${globalSettings.timetable.TotalDuration} hours.`
          });
      }

      // Add the new session to the existing timetable
      timetable.sessions.push(session);
    } else {
      // If no timetable exists, create a new one with the session, ensuring the single session does not exceed the daily limit
      if (newSessionDuration > globalSettings.timetable.TotalDuration) {
          return res.status(400).json({
              status: 'error',
              message: `Session duration exceeds the daily limit of ${globalSettings.timetable.TotalDuration} hours.`
          });
      }

      // Check if startDate and endDate are provided, if not, use default values
      const timetableStartDate = startDate || new Date(); // Default to current date if not provided
      const timetableEndDate = endDate || new Date(); // Default to current date if not provided
      
      timetable = new Timetable({
          semester,
          year,
          classId,
          sessions: [session],
          startDate: timetableStartDate,
          endDate: timetableEndDate
      });
    }

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
    const { departmentId, academicYear } = req.query; // Assuming these are passed as query parameters

    // First, find classes in the specified department and academic year
    const classes = await Class.find({
      department: departmentId,
      year: academicYear
    }, '_id'); // Only fetch class IDs

    if (!classes.length) {
      return res.status(404).json({ status: 'error', message: 'No classes found for the specified department and academic year.' });
    }

    // Convert class documents to an array of their IDs
    const classIds = classes.map(cls => cls._id);

    // Then, find timetables for these classes
    const timetables = await Timetable.find({ classId: { $in: classIds } }).populate({
      path: 'sessions',
      match: { day: { $in: ['MON', 'TUE', 'WED', 'THU', 'FRI'] } },
    });

    if (!timetables.length) {
      return res.status(404).json({ status: 'error', message: 'Timetable not found for the specified classes.' });
    }

    // Construct a weekly timetable
    const weeklyTimetable = timetables.reduce((acc, timetable) => {
      timetable.sessions.forEach(session => {
        if (!acc[session.day]) acc[session.day] = [];
        acc[session.day].push(session);
      });
      return acc;
    }, {});

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


