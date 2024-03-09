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
  // Convert session start time and timestamp to Date objects if they're not already
  if (!(sessionStartTime instanceof Date)) {
    sessionStartTime = new Date(sessionStartTime);
  }
  if (!(timestamp instanceof Date)) {
    timestamp = new Date(timestamp);
  }

  // Extract hours and minutes to compare times only
  const sessionStartHours = sessionStartTime.getUTCHours();
  const sessionStartMinutes = sessionStartTime.getUTCMinutes();
  const timestampHours = timestamp.getUTCHours();
  const timestampMinutes = timestamp.getUTCMinutes();

  // Convert hours and minutes to minutes for comparison
  const sessionStartTotalMinutes = sessionStartHours * 60 + sessionStartMinutes;
  const timestampTotalMinutes = timestampHours * 60 + timestampMinutes;

  // Define the check-in window in minutes (15 minutes before and after session starts)
  const earlyCheckInStart = sessionStartTotalMinutes - 15;
  const onTimeCheckInEnd = sessionStartTotalMinutes + 15;

  // Determine attendance status based on time comparison
  if (timestampTotalMinutes < earlyCheckInStart) {
    return 'Too Early'; // More than 15 minutes before session starts
  } else if (timestampTotalMinutes >= earlyCheckInStart && timestampTotalMinutes <= sessionStartTotalMinutes) {
    return 'Early'; // Within 15 minutes before session start, inclusive
  } else if (timestampTotalMinutes > sessionStartTotalMinutes && timestampTotalMinutes <= onTimeCheckInEnd) {
    return 'On Time'; // From session start time to 15 minutes after
  } else {
    return 'Late'; // After the on-time window
  }
}

// Record attendance in the database
// Record attendance in the database
async function recordAttendance(studentId, sessionId, date, status) {
  // Find or create the attendance record
  let attendance = await Attendance.findOne({ studentId: studentId, date: date });

  if (!attendance) {
    attendance = new Attendance({
      studentId: studentId,
      date: date,
    });
  } else {
    // Check if the session has already been checked in
    const sessionCheckInIndex = attendance.checkIns.findIndex(checkIn => checkIn.sessionId && checkIn.sessionId.toString() === sessionId.toString());

    if (sessionCheckInIndex !== -1) {
      // If the session is already checked in, throw an error or handle as needed
      throw new Error('Already checked in for this session.');
    }
  }

  // Assuming sessionId is defined and contains the correct ID for the session
  attendance.checkIns.push({
    sessionId: sessionId, // Use the actual session ID variable here
    time: new Date(),
    status: status,
  });

  await attendance.save();

  return attendance;
}
// Find the current or next available session for check-in
async function findSessionForCheckIn(studentId, timestamp) {
  const dayOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][timestamp.getDay()];
  const now = timestamp.getHours() * 60 + timestamp.getMinutes();

  console.log('Timestamp:', timestamp);
  console.log('Day of week:', dayOfWeek);
  console.log('Current time in minutes:', now);

  const timetable = await Timetable.findOne({
    'sessions.day': dayOfWeek,
  });

  console.log('Timetable:', timetable);

  if (!timetable) {
    return null; // No matching timetable found
  }

  // Adjusted to filter sessions based on the current time and allow check-in 15 minutes before session start
  const session = timetable.sessions.find(session => {
    const sessionStartTime = new Date(session.startTime).getHours() * 60 + new Date(session.startTime).getMinutes();
    const sessionEndTime = new Date(session.endTime).getHours() * 60 + new Date(session.endTime).getMinutes();
    const earlyCheckInStartTime = sessionStartTime - 20; // Allow check-in 20 minutes before the session starts
    const checkInEndTime = sessionStartTime + 20; // Allow check-in until 20 minutes after the session starts

    return (
      session.day === dayOfWeek &&
      now >= earlyCheckInStartTime && // Check-in time is within 15 minutes before session start
      now <= checkInEndTime && // Check-in time is within 15 minutes of session start
      sessionEndTime >= now // Current time is before the session end time
    );
  });

  console.log('Session:', session);

  if (!session) {
    return null; // No available session for check-in or it's too late to check in
  }

  // Ensure the session is present in the timetable
  const timetableSession = await Timetable.findOne({
    _id: timetable._id,
    'sessions._id': session._id,
  });

  console.log('Timetable Session:', timetableSession);

  if (!timetableSession) {
    return null; // Session not found in the timetable
  }

  return session;
}

// Main check-in function
exports.checkIn = async (req, res) => {
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

    // Find the current session for check-in
    const session = await findSessionForCheckIn(student._id, timestamp);
    if (!session) {
      return res.status(404).json({ message: 'No session available for check-in at this time.' });
    }

    // Ensure the session is present in the timetable
    const timetableSession = await Timetable.findOne({
      _id: session._id, // Assuming session has a unique identifier
      'sessions.startTime': session.startTime,
      'sessions.endTime': session.endTime,
    });
    // Determine attendance status and record attendance
    const attendanceStatus = determineAttendanceStatus(session.startTime, timestamp);
    const date = new Date(timestamp).setHours(0, 0, 0, 0); // Normalize the date
    const attendanceRecord = await recordAttendance(studentId, session._id, date, attendanceStatus);

    res.status(200).json({ message: 'Check-in successful', session: session, attendance: attendanceRecord });
  } catch (err) {
    console.error('Error during check-in:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Main checkout function
exports.checkOut = async (req, res) => {
  const { studentId, nfcTagId, biometricData } = req.body;
  const timestamp = new Date(); // Ensure timestamp is defined for this scope

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

    const session = await findSessionForCheckout(student._id, timestamp);
    if (!session) {
      return res.status(404).json({ message: 'No session available for checkout at this time.' });
    }

    const checkoutStatus = determineCheckoutStatus(session.endTime, timestamp);
    const date = timestamp.setHours(0, 0, 0, 0); // Normalize the date
    const attendanceRecord = await recordCheckout(studentId, session._id, date, checkoutStatus, nfcTagId, biometricData, timestamp);

    res.status(200).json({ message: 'Checkout successful', session: session, attendance: attendanceRecord });
  } catch (err) {
    console.error('Error during checkout:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

async function findSessionForCheckout(studentId, timestamp) {
  const dayOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][timestamp.getDay()];
  const now = timestamp.getHours() * 60 + timestamp.getMinutes();

  // Added logging statements
  console.log('Timestamp:', timestamp);
  console.log('Day of week:', dayOfWeek);
  console.log('Current time in minutes:', now);

  // Find the timetable that includes today's date and sessions for the student
  const timetable = await Timetable.findOne({
    'sessions.day': dayOfWeek,
  });

  console.log('Timetable:', timetable);

  if (!timetable) {
    return null; // No matching timetable found
  }

  // Filter sessions to find the most relevant session for checkout
  const session = timetable.sessions.find(session => {
    const sessionEndTime = new Date(session.endTime).getHours() * 60 + new Date(session.endTime).getMinutes();
    const lateCheckoutEndTime = sessionEndTime + 15; // Assuming a 15-minute grace period after session ends

    return (
      session.day === dayOfWeek &&
      now <= lateCheckoutEndTime && // Checkout time is within the grace period after the session ends
      sessionEndTime < now // Ensuring the session has ended
    );
  });

  if (!session) {
    return null; // No suitable session found for checkout
  }

  console.log('Session:', session);
  
  // Ensure the session is still relevant for the checkout process
  const relevantSession = await Timetable.findOne({
    _id: timetable._id,
    'sessions._id': session._id,
  });

  console.log('Timetable Session:', relevantSession);

  if (!relevantSession) {
    return null; // Session not found in the timetable
  }

  return session; // Return the found session
}

function determineCheckoutStatus(sessionEndTime, checkoutTime) {
  // Convert session end time and checkout time to Date objects if they're not already
  if (!(sessionEndTime instanceof Date)) {
    sessionEndTime = new Date(sessionEndTime);
  }
  if (!(checkoutTime instanceof Date)) {
    checkoutTime = new Date(checkoutTime);
  }

  // Extract hours and minutes to compare times only
  const sessionEndHours = sessionEndTime.getUTCHours();
  const sessionEndMinutes = sessionEndTime.getUTCMinutes();
  const checkoutHours = checkoutTime.getUTCHours();
  const checkoutMinutes = checkoutTime.getUTCMinutes();

  // Convert hours and minutes to minutes for comparison
  const sessionEndTotalMinutes = sessionEndHours * 60 + sessionEndMinutes;
  const checkoutTotalMinutes = checkoutHours * 60 + checkoutMinutes;

  // Define the checkout window in minutes (grace period after session ends)
  const lateCheckoutEnd = sessionEndTotalMinutes + 15; // Example: 15 minutes after session ends

  // Determine checkout status based on time comparison
  if (checkoutTotalMinutes <= lateCheckoutEnd) {
    return 'Completed'; // Within grace period after session end
  } else {
    return 'LeftEarly'; // After the grace period
  }
}

// Record checkout in the database
async function recordCheckout(studentId, sessionId, date, checkoutStatus, nfcTagId, biometricData, checkoutTime) {
  // Find the attendance record for the given date
  let attendance = await Attendance.findOne({ studentId: studentId, date: date });

  if (!attendance) {
    // If no attendance record exists for this date, it's a logic error since checkout assumes check-in
    console.error('No attendance record found for checkout. Student ID:', studentId, 'Date:', date);
    throw new Error('No attendance record found for this date.');
  }

  // Check if there is already a checkout for the given session ID
  const alreadyCheckedOut = attendance.checkOuts.some(checkOut => checkOut.sessionId.equals(sessionId));
  
  if (alreadyCheckedOut) {
    console.log('Student has already checked out from this session. Skipping duplicate checkout.');
    // Optionally, you can update the existing checkout here if needed
    return attendance; // Return the existing attendance record without changes
  }

  // Calculate class duration in hours
  const session = await Timetable.findOne({
    'sessions._id': sessionId
  }, {
    sessions: { $elemMatch: { _id: sessionId } }
  });

  if (!session) {
    console.error('Session not found for checkout. Session ID:', sessionId);
    throw new Error('Session not found.');
  }

  const sessionStart = new Date(session.sessions[0].startTime);
  const sessionEnd = new Date(session.sessions[0].endTime);
  const classDurationHours = (sessionEnd - sessionStart) / (1000 * 60 * 60); // Duration in hours

  // Update the attendance record with checkout details, since no duplicate was found
  attendance.checkOuts.push({
    sessionId: sessionId, // Make sure to include this to uniquely identify the session
    time: checkoutTime,
    nfcTagId: nfcTagId,
    biometricData: biometricData,
    classDurationHours: classDurationHours,
    sessionStatus: checkoutStatus, // 'Completed' or 'LeftEarly'
  });

  // Save the updated attendance record
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
        // Find or create the attendance record for the student for today's date
        let attendanceRecord = await Attendance.findOneAndUpdate(
          { studentId: student._id, date: date },
          { $setOnInsert: { studentId: student._id, date: date } }, // Set default values if the record doesn't exist
          { upsert: true, new: true }
        );

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
    end.setHours(23, 59, 59, 999); // Set end date to the end of the day

    // MongoDB aggregation to calculate attendance statistics
    const summary = await Attendance.aggregate([
      // Match records within the date range for the specified class
      // Assuming studentId in Attendance refers to the student, not class. Adjust accordingly if needed.
      {
        $match: {
          date: { $gte: start, $lte: end },
        },
      },
      // Lookup to join with StudentDetails to filter by classId
      {
        $lookup: {
          from: 'studentdetails',
          localField: 'studentId',
          foreignField: '_id',
          as: 'studentInfo',
        },
      },
      // Filter documents after lookup to include only those belonging to the specified classId
      {
        $match: {
          'studentInfo.classId': mongoose.Types.ObjectId(classId),
        },
      },
      // Group by student ID to aggregate attendance data
      {
        $group: {
          _id: '$studentId',
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
      // Optional: Format the output
      {
        $project: {
          studentId: '$_id',
          totalClasses: 1,
          presentCount: 1,
          lateCount: 1,
          absentCount: 1,
          totalDuration: 1,
          studentInfo: { $first: '$studentInfo' }, // Adjust based on your data structure
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
    const monthInt = parseInt(month, 10);
    const yearInt = parseInt(year, 10);

    // Validate month and year
    if (monthInt < 1 || monthInt > 12 || isNaN(monthInt) || isNaN(yearInt)) {
      return res.status(400).json({ message: 'Invalid month or year' });
    }

    // Calculate the first and last day of the month
    const startDate = new Date(Date.UTC(yearInt, monthInt - 1, 1));
    const endDate = new Date(Date.UTC(yearInt, monthInt, 0, 23, 59, 59, 999));

    // Find all attendance records for the student in the given month
    const attendanceRecords = await Attendance.find({
      studentId: mongoose.Types.ObjectId(studentId),
      date: { $gte: startDate, $lte: endDate },
    });

    // Calculate the number of present, late, and absent days
    const attendanceSummary = attendanceRecords.reduce((acc, record) => {
      acc[record.status] = (acc[record.status] || 0) + 1;
      acc.totalDuration += record.classDurationHours || 0;
      return acc;
    }, { Present: 0, Late: 0, Absent: 0, totalDuration: 0 });

    // Calculate the total number of session days in the month
    // This requires a hypothetical function `getSessionDays` that calculates the total session days
    // For the purpose of this example, let's assume it returns a fixed number
    // Please replace this with your actual function to calculate session days
    const totalSessionDays = await getSessionDays(startDate, endDate, studentId);

    // Calculate the attendance percentage
    const attendancePercentage = ((attendanceSummary.Present + attendanceSummary.Late) / totalSessionDays) * 100;

    // Respond with the updated attendance data
    res.json({
      studentId,
      month: monthInt,
      year: yearInt,
      attendancePercentage: attendancePercentage.toFixed(2),
      totalDurationInHours: (attendanceSummary.totalDuration / 60).toFixed(2),
      presentDays: attendanceSummary.Present,
      lateDays: attendanceSummary.Late,
      absentDays: attendanceSummary.Absent,
      totalSessionDays,
      details: attendanceRecords,
    });
  } catch (err) {
    console.error('Error calculating monthly attendance:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

async function getSessionDays(startDate, endDate, studentId) {
  const classIds = await getClassIdsForStudent(studentId);
  if (classIds.length === 0) {
    return 0; // Early return if no class IDs are associated with the student
  }

  const timetables = await Timetable.find({
    classId: { $in: classIds },
    $or: [
      { startDate: { $lte: endDate }, endDate: { $gte: startDate } },
      { startDate: { $lte: startDate }, endDate: { $gte: endDate } },
    ],
  }).lean();

  let sessionDaysSet = new Set();
  timetables.forEach(timetable => {
    timetable.sessions.forEach(session => {
      // Example assumes 'day' is stored as 'MON', 'TUE', etc.
      sessionDaysSet.add(session.day.toUpperCase());
    });
  });

  // Calculate the total number of unique session days
  let totalSessionDays = 0;
  sessionDaysSet.forEach(dayOfWeek => {
    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      if (currentDate.getUTCDay() === convertDayToNumber(dayOfWeek)) {
        totalSessionDays++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
  });

  return totalSessionDays;
}

function convertDayToNumber(day) {
  const mapping = { "SUN": 0, "MON": 1, "TUE": 2, "WED": 3, "THU": 4, "FRI": 5, "SAT": 6 };
  return mapping[day];
}



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
