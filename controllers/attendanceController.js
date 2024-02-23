const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const StudentDetails = require('../models/StudentDetails');
const NFCData = require('../models/NFCData');
const BiometricData = require('../models/biometricData');
const Attendance = require('../models/attendance');
const Timetable = require('../models/Timetable');
const globalSettings = require('../config/globalSettings');
const cron = require('node-cron');
const cryptoUtils = require('../helpers/encryption');


// Validate NFC data
async function validateNFC(nfcTagId, studentId) {
  if (!nfcTagId) return true;
  const nfcValid = await NFCData.findOne({ studentId, tagId: nfcTagId });
  return !!nfcValid;
}

// Validate Biometric data
async function validateBiometric(biometricData, studentId) {
  if (!biometricData) return true;
  const biometricRecord = await BiometricData.findOne({ studentId });
  if (!biometricRecord) return false;
  const decryptedBiometricData = cryptoUtils.decrypt(biometricRecord.template);
  return biometricData === decryptedBiometricData;
}

// Determine the attendance status based on check-in time and session start time
function determineAttendanceStatus(sessionStartTime, timestamp) {
  const gracePeriodEndTime = new Date(sessionStartTime.getTime() + globalSettings.attendance.gracePeriodMinutes * 60000);
  const checkInWindowStartTime = new Date(sessionStartTime.getTime() - globalSettings.attendance.checkInWindowMinutes * 60000);

  if (timestamp < checkInWindowStartTime) {
      return 'Too Early';
  } else if (timestamp <= gracePeriodEndTime) {
      return 'On Time';
  } else {
      return 'Late';
  }
}

// Record attendance in the database
async function recordAttendance(studentId, sessionId, date, status) {
  // Find the attendance record or create a new one if it doesn't exist
  let attendance = await Attendance.findOne({ studentId: studentId, date: date });

  if (!attendance) {
    // If no attendance record exists for this date, create a new one
    attendance = new Attendance({
      studentId: studentId,
      date: date,
      // Initialize the arrays as needed; for example, add a session to absences if marking an absence
    });
  }

  // Based on your logic, update the attendance record
  // This could involve pushing a new check-in record, updating status, etc.
  // For example:
  attendance.checkIns.push({
    time: new Date(), // Use the actual check-in time
    status: status, // 'OnTime', 'Late', etc.
  });

  // Save the updated attendance record
  await attendance.save();

  return attendance;
}


// Find the current or next available session for check-in
async function findSessionForCheckIn(studentId, timestamp) {
  const dayOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][timestamp.getDay()];
  const now = timestamp.getHours() * 60 + timestamp.getMinutes();
  const sessions = await Timetable.aggregate([
      { $match: { 'sessions.day': dayOfWeek } },
      { $unwind: '$sessions' },
      { $match: { 'sessions.day': dayOfWeek, 'sessions.startTime': { $gte: new Date(timestamp.toISOString()) } } },
      { $sort: { 'sessions.startTime': 1 } },
      { $limit: 1 }
  ]);

  return sessions[0];
}

// Main check-in function
exports.checkIn = async (req, res) => {
  const { currentTime, studentId, nfcTagId , biometricData } = req.body;
  const timestamp = new Date(currentTime);

  try {
      if (globalSettings.isNonWorkingDay(timestamp)) {
          return res.status(400).json({ message: 'Cannot check in on non-working days.' });
      }

      const student = await StudentDetails.findById(studentId);
      if (!student) return res.status(404).json({ message: 'Student not found' });

      const isValidNFC = await validateNFC(nfcTagId, student._id);
      const isValidBiometric = await validateBiometric(biometricData, student._id);
      if (!isValidNFC || !isValidBiometric) {
          return res.status(400).json({ message: 'Invalid NFC or Biometric data' });
      }

      const session = await findSessionForCheckIn(student._id, timestamp);
      if (!session) return res.status(404).json({ message: 'No session available for check-in at this time.' });

      const attendanceStatus = determineAttendanceStatus(new Date(session.sessions.startTime), timestamp);
      const date = new Date(timestamp).setHours(0, 0, 0, 0); // Normalize the date
      const attendanceRecord = await recordAttendance(studentId, session.sessions._id, date, attendanceStatus);

      res.status(200).json({ message: 'Check-in successful', session: session.sessions, attendance: attendanceRecord });
  } catch (err) {
      console.error('Error during check-in:', err);
      res.status(500).json({ message: 'Server error', error: err.message });
  }
};


// Function to handle student check-out
exports.checkOut = async (req, res) => {
  const { studentId, nfcTagId, biometricData } = req.body;
    const timestamp = new Date();

    try {
        const student = await StudentDetails.findById(studentId);
        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        const isValidNFC = await validateNFC(nfcTagId, student._id);
        const isValidBiometric = await validateBiometric(biometricData, student._id);
        if (!isValidNFC || !isValidBiometric) {
            return res.status(400).json({ message: 'Invalid NFC or Biometric data' });
        }

        // Assuming a function to find the current session based on the timestamp
        // This could be similar to `findSessionForCheckIn` but tailored for checkout
        const session = await findCurrentSessionForCheckout(student._id, timestamp);
        if (!session) {
            return res.status(404).json({ message: 'No active session found for checkout.' });
        }

        // Update the attendance record to reflect the checkout
        // This could involve setting a checkout time or updating the status
        const updatedAttendance = await recordCheckout(studentId, session.sessions._id, timestamp);
        
        res.status(200).json({ message: 'Checkout successful', session: session.sessions, attendance: updatedAttendance });
    } catch (err) {
        console.error('Error during checkout:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
}

async function findCurrentSessionForCheckout(studentId, timestamp) {
  const dayOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][timestamp.getDay()];
  const currentSessions = await Timetable.aggregate([
      { $match: { 'sessions.day': dayOfWeek } },
      { $unwind: '$sessions' },
      { $match: {
          'sessions.startTime': { $lte: new Date(timestamp) },
          'sessions.endTime': { $gte: new Date(timestamp) }
      }},
      { $sort: { 'sessions.endTime': -1 } },
      { $limit: 1 }
  ]);

  return currentSessions.length > 0 ? currentSessions[0] : null;
}

async function recordCheckout(studentId, sessionId, timestamp) {
  const date = new Date(timestamp).setHours(0, 0, 0, 0); // Normalize the date to the start of the day
  const attendance = await Attendance.findOne({
      studentId: mongoose.Types.ObjectId(studentId),
      sessionId: mongoose.Types.ObjectId(sessionId),
      date: date
  });

  if (!attendance) {
      console.log('No attendance record found for checkout.');
      return null; // Adjust based on your application's needs
  }

  const session = await Timetable.findById(sessionId);
  if (!session) {
      console.log('Session not found.');
      return null; // Adjust based on your application's needs
  }

  const sessionDuration = (new Date(session.endTime) - new Date(session.startTime)) / (1000 * 60 * 60);
  const minimumRequiredDuration = sessionDuration <= 2 ? sessionDuration - 0.25 : sessionDuration - 0.75;

  const lastCheckIn = attendance.checkIns[attendance.checkIns.length - 1];
  const checkInTime = new Date(lastCheckIn.time);
  const checkoutTime = new Date(timestamp);
  const attendedDurationHours = (checkoutTime - checkInTime) / (1000 * 60 * 60);

  if (attendedDurationHours >= minimumRequiredDuration) {
      // Update the attendance record with checkout information
      attendance.checkOuts.push({
          time: checkoutTime,
          classDurationHours: attendedDurationHours
      });

      // Update status based on attended duration
      attendance.status = 'Present';
  } else {
      // Handle scenarios where attended duration is less than required
      attendance.status = 'Incomplete';
  }

  await attendance.save();
  return attendance;
}


// Function to perform periodic checks and update attendance records
async function performPeriodicCheck() {
  try {
    const currentTimestamp = new Date();
    // Find sessions that are currently supposed to be happening
    const currentSessions = await Timetable.find({
      startTime: { $lte: currentTimestamp },
      endTime: { $gte: currentTimestamp },
    });

    // Iterate over each session that is currently active
    for (const session of currentSessions) {
      // Find all students associated with the class of the current session
      const students = await StudentDetails.find({ classId: session.classId });

      for (const student of students) {
        // Set the date to the beginning of the day for consistent querying
        const date = new Date(currentTimestamp).setHours(0, 0, 0, 0);
        // Find the attendance record for the student for today's date
        let attendanceRecord = await Attendance.findOne({
          studentId: student._id,
          date: date,
        });

        // If there is no attendance record for today, create a new one
        if (!attendanceRecord) {
          attendanceRecord = new Attendance({
            studentId: student._id,
            date: date,
            checkIns: [],
            checkOuts: [],
            absences: [],
            status: 'Absent', // Assume absent by default
          });
        }

        // If the student has not checked in, mark them as absent
        if (!attendanceRecord.checkIns.some(checkIn => checkIn.sessionId.equals(session._id))) {
          attendanceRecord.absences.push({
            sessionId: session._id,
            time: currentTimestamp,
          });
        }

        // Save the updated attendance record
        await attendanceRecord.save();
      }
    }
  } catch (error) {
    console.error('Error performing periodic check:', error);
  }
}

// Function to get attendance summary
exports.getAttendanceSummary = async (req, res) => {
  try {
    const { classId, startDate, endDate } = req.query;

    // Validate query parameters
    if (!classId || !startDate || !endDate) {
      return res.status(400).json({ message: 'Missing required parameters' });
    }

    // Convert startDate and endDate to Date objects
    const start = new Date(startDate);
    const end = new Date(endDate);

    // MongoDB aggregation to calculate attendance statistics
    const summary = await Attendance.aggregate([
      // Match records within the date range for the specified class
      {
        $match: {
          studentId: mongoose.Types.ObjectId(classId),
          date: { $gte: start, $lte: end },
        },
      },
      // Group by student ID and date, and aggregate attendance data
      {
        $group: {
          _id: {
            studentId: '$studentId',
            date: '$date',
          },
          totalClasses: { $sum: 1 },
          presentCount: {
            $sum: { $cond: [{ $eq: ['$status', 'Present'] }, 1, 0] },
          },
          lateCount: {
            $sum: { $cond: [{ $eq: ['$status', 'Late'] }, 1, 0] },
          },
          absentCount: {
            $sum: { $cond: [{ $eq: ['$status', 'Absent'] }, 1, 0] },
          },
          totalDuration: {
            $sum: '$classDurationHours', // Assuming you have a field named classDurationHours in the Attendance collection
          },
        },
      },
      // Optional: Join with the StudentDetails collection to get student information
      {
        $lookup: {
          from: 'studentdetails',
          localField: '_id.studentId',
          foreignField: '_id',
          as: 'studentInfo',
        },
      },
      // Optional: Format the output
      {
        $project: {
          studentId: '$_id.studentId',
          date: '$_id.date',
          totalClasses: 1,
          presentCount: 1,
          lateCount: 1,
          absentCount: 1,
          totalDuration: 1,
          studentInfo: { $arrayElemAt: ['$studentInfo', 0] }, // Extract the student info
        },
      },
    ]);

    // Send the response
    res.json({ status: 'success', data: summary });
  } catch (err) {
    console.error('Error getting attendance summary:', err);
    res.status(500).json({ status: 'error', message: 'Server error', error: err });
  }
};

// Function to calculate monthly attendance
exports.calculateMonthlyAttendance = async (req, res) => {
  try {
    const { month, year, studentId } = req.query;

    // Check if the required parameters are provided
    if (!month || !year || !studentId) {
      return res.status(400).json({ message: 'Missing required parameters: month, year, and studentId' });
    }

    // Parse month and year to integers
    const monthInt = parseInt(month);
    const yearInt = parseInt(year);

    // Calculate the first and last day of the month
    const startDate = new Date(yearInt, monthInt - 1, 1);
    const endDate = new Date(yearInt, monthInt, 0);

    // Find all attendance records for the student in the given month
    const attendanceRecords = await Attendance.find({
      studentId: mongoose.Types.ObjectId(studentId),
      date: { $gte: startDate, $lte: endDate }
    });

    // Calculate the number of present days
    const presentDays = attendanceRecords.filter(record => record.status === 'Present').length;

    // Calculate the total number of session days in the month
    // Assuming you have a function getSessionDays to calculate the total session days
    const totalSessionDays = await getSessionDays(startDate, endDate, studentId);

    // Calculate the total attendance hours duration in class
    const totalDurationInMinutes = attendanceRecords.reduce((total, record) => total + record.classDurationHours, 0);
    const totalDurationInHours = totalDurationInMinutes / 60;

    // Calculate the attendance percentage
    const attendancePercentage = (presentDays / totalSessionDays) * 100;

    // Respond with the updated attendance data
    res.json({
      studentId,
      month: monthInt,
      year: yearInt,
      attendancePercentage: attendancePercentage.toFixed(2),
      totalDurationInHours: totalDurationInHours.toFixed(2), // Total duration in hours
      details: attendanceRecords
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Function to calculate semester attendance
exports.calculateSemesterAttendance = async (req, res) => {
  try {
    const { studentId, semesterStartDate, semesterEndDate } = req.query;

    // Validate query parameters
    if (!studentId || !semesterStartDate || !semesterEndDate) {
      return res.status(400).json({ message: 'Missing required parameters' });
    }

    // Convert startDate and endDate to Date objects
    const start = new Date(semesterStartDate);
    const end = new Date(semesterEndDate);

    // Find all attendance records for the student in the current semester
    const attendanceRecords = await Attendance.find({
      studentId: mongoose.Types.ObjectId(studentId),
      date: { $gte: start, $lte: end },
    });

    // Calculate the total hours in the semester
    const totalHoursInSemester = await getTotalHoursInSemester(start, end); // Replace with your logic

    // Calculate the total hours attended by the student in the semester
    const totalHoursAttended = attendanceRecords.reduce((total, record) => {
      return total + (record.classDurationHours || 0); // Assuming classDurationHours is the field with hours
    }, 0);

    // Calculate the attendance percentage
    const attendancePercentage = (totalHoursAttended / totalHoursInSemester) * 100;

    // Respond with the calculated data
    res.json({
      studentId,
      semesterStartDate,
      semesterEndDate,
      totalHoursInSemester,
      totalHoursAttended,
      attendancePercentage: attendancePercentage.toFixed(2),
      details: attendanceRecords,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

async function getTotalHoursInSemester(startDate, endDate) {
  try {
    // Assuming you have a database model named 'Timetable' with a 'duration' field for class sessions
    const classes = await Timetable.find({
      sessions: {
        $elemMatch: {
          startTime: { $gte: startDate },
          endTime: { $lte: endDate },
        }
      }
    });

    // Calculate the total hours by summing the durations of all class sessions
    const totalHoursInSemester = classes.reduce((total, timetable) => {
      // Iterate over the sessions of each timetable and sum the durations
      const timetableHours = timetable.sessions.reduce((timetableTotal, session) => {
        const sessionDuration = (session.endTime - session.startTime) / (1000 * 60 * 60); // Duration in hours
        return timetableTotal + sessionDuration;
      }, 0);

      return total + timetableHours;
    }, 0);

    return totalHoursInSemester;
  } catch (error) {
    console.error('Error calculating total hours:', error);
    // Handle the error appropriately, e.g., return a default value or throw an error
    throw error;
  }
}


   
cron.schedule(globalSettings.periodicCheck.interval, performPeriodicCheck);
