const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const StudentDetails = require('../models/StudentDetails');
const NFCData = require('../models/NFCData');
const BiometricData = require('../models/biometricData');
const Attendance = require('../models/attendance');
const Timetable = require('../models/Timetable');
const globalSettings = require('../config/globalSettings');
const cron = require('node-cron');


// Function to record student attendance for a session
exports.checkIn = async (req, res) => {
  try {
    const { currentTime, studentId, nfcTagId, biometricData } = req.body;
    const timestamp = new Date(currentTime);

    // Fetch student details
    const student = await StudentDetails.findById(studentId);
    if (!student) return res.status(404).json({ message: 'Student not found' });

    // Validate NFC or Biometric data
    const isValidNFC = nfcTagId ? await NFCData.findOne({ studentob_Id: student._id, tagId: nfcTagId }) : true;
    const biometricRecord = await BiometricData.findOne({ studentob_Id: student._id });
    const isValidBiometric = biometricData && biometricRecord ? await bcrypt.compare(biometricData, biometricRecord.template) : true;

    if (!isValidNFC && !isValidBiometric) return res.status(400).json({ message: 'Invalid NFC or Biometric data' });

    // Find current or next session for check-in
    const day = timestamp.toLocaleString('en-US', { weekday: 'short' }).toUpperCase();
    const currentSession = await Timetable.findOne({
      classId: student.classId,
      sessions: {
        $elemMatch: {
          day,
          startTime: { $lte: timestamp },
          endTime: { $gte: timestamp }
        }
      }
    });

    if (!currentSession) return res.status(400).json({ message: 'No class scheduled at this time' });

    const session = currentSession.sessions.find(s => 
      s.day === day && 
      s.startTime <= timestamp && 
      s.endTime >= timestamp
    );

    if (!session) return res.status(400).json({ message: 'No session found within the current timetable' });

    // Logic to determine attendance status (OnTime, Late, VeryLate)
    // Placeholder - Implement based on your rules
    const attendanceStatus = 'OnTime';

    // Record attendance
    const attendanceRecord = await Attendance.findOneAndUpdate(
      { studentId, date: timestamp.toISOString().split('T')[0] },
      { $push: { checkIns: { time: timestamp, sessionType: session.sessionType, status: attendanceStatus } } },
      { upsert: true, new: true }
    );

    res.status(200).json({ message: 'Check-in recorded successfully', data: attendanceRecord });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};



// Function to handle student check-out
exports.checkOut = async (req, res) => {
  try {
    const { studentId, currentTime, nfcTagId, biometricData } = req.body;

    // Fetch the student's details
    const student = await StudentDetails.findById(studentId);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    if (student.status !== 'approved') {
      return res.status(403).json({ message: 'Student not approved for check-out' });
    }

    // Authenticate using NFC and/or biometric data here
    let isValidNFC = !nfcTagId || await NFCData.exists({ studentId, tagId: nfcTagId });
    let isValidBiometric = await bcrypt.compare(biometricData, BiometricData.template);

    if (!isValidNFC || !isValidBiometric) {
      return res.status(401).json({ message: 'NFC or biometric authentication failed' });
    }

    const timestamp = new Date(currentTime);
    const date = timestamp.setHours(0, 0, 0, 0);

    let attendanceRecord = await Attendance.findOne({ studentId: student._id, date: date });
    if (!attendanceRecord) {
      return res.status(400).json({ message: 'No check-in record found for this student on this date' });
    }

    if (attendanceRecord.checkIns.length === 0) {
      return res.status(400).json({ message: 'Cannot check out before checking in' });
    }

    // Determine the minimum checkout time
    const currentSession = await Timetable.findOne({
      _id: attendanceRecord.checkIns[0].sessionId
    });
    if (!currentSession) {
      return res.status(400).json({ message: 'No class session found for check-in' });
    }

    const sessionStartTime = new Date(currentSession.startTime);
    const minimumDuration = globalSettings.attendance.minimumSessionDurationMinutes; // Minimum duration in minutes
    const minimumCheckoutTime = new Date(sessionStartTime.getTime() + minimumDuration * 60 * 1000);

    if (timestamp < minimumCheckoutTime) {
      return res.status(400).json({ message: `Checkout time is too early. Minimum checkout time is ${minimumCheckoutTime.toISOString()}.` });
    }

    // Proceed to record the check-out time
    const checkoutTime = timestamp;
    attendanceRecord.checkOuts.push({ time: checkoutTime, nfcTagId, biometricData });

    const durationInMilliseconds = checkoutTime - attendanceRecord.checkIns[0].time;
    const durationInMinutes = Math.floor(durationInMilliseconds / (1000 * 60));
    const durationInHours = durationInMinutes / 60;
    attendanceRecord.classDurationHours = durationInHours;

    await attendanceRecord.save();
    res.status(200).json({ message: 'Check-out recorded successfully', attendanceRecord });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};


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
