const cron = require('node-cron');
const mongoose = require('mongoose');
const StudentDetails = require('../models/StudentDetails');
const NFCData = require('../models/NFCData');
const BiometricData = require('../models/biometricData');
const Attendance = require('../models/Attendance');
const Timetable = require('../models/Timetable');
const globalSettings = require('../config/globalSettings');


// Utility function to determine if a session is a lecture or lab
const getSessionType = (duration) => duration >= 3 ? 'LAB' : 'LECTURE';

// Function to record student attendance for a session
exports.checkIn = async (req, res) => {
  try {
    const { studentId, nfcTagId, biometricData, currentTime, exceptionalCircumstances, exceptionDuration } = req.body;
    const timestamp = new Date(currentTime);

    // Fetch the student's details
    const student = await StudentDetails.findById(studentId);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    if (student.status !== 'approved') {
      return res.status(403).json({ message: 'Student not approved for check-in' });
    }

    // Validate NFC or biometric data
    let isValidNFC = !nfcTagId || await NFCData.exists({ studentId, tagId: nfcTagId });
    let isValidBiometric = await bcrypt.compare(req.body.biometricData, BiometricData.template);

    if (!isValidNFC && !isValidBiometric) { // Ensure both conditions are properly checked
      return res.status(400).json({ message: 'Invalid NFC or Biometric data' });
    }

    // Determine the status (OnTime, Late, or VeryLate) based on class schedule
    const currentSession = await Timetable.findOne({
      day: timestamp.toLocaleString('en-US', { weekday: 'short' }).toUpperCase(),
      startTime: { $lte: timestamp },
      endTime: { $gte: timestamp }
    });

    if (!currentSession) {
      return res.status(400).json({ message: 'No class scheduled at this time' });
    }

    const classStartTime = new Date(currentSession.startTime);
    const classDuration = (currentSession.endTime - currentSession.startTime) / (1000 * 60 * 60); // Duration in hours
    const classStartWindow = new Date(classStartTime.getTime() - globalSettings.attendance.checkInWindowMinutes * 60000);
    const lateWindowEnd = new Date(classStartTime.getTime() + globalSettings.attendance.gracePeriodMinutes * 60000);
    const veryLateWindowEnd = classDuration >= 3 ? new Date(classStartTime.getTime() + (classDuration / 2 * 60 * 60 * 1000)) : lateWindowEnd;

    let status;
    if (timestamp >= classStartWindow && timestamp <= classStartTime) {
      status = 'OnTime';
    } else if (timestamp > classStartTime && timestamp <= lateWindowEnd) {
      status = 'Late';
    } else if (timestamp > lateWindowEnd && timestamp <= veryLateWindowEnd) {
      status = classDuration >= 3 ? 'VeryLate' : 'Late';
    } else {
      return res.status(400).json({ message: 'Check-in time is outside the permitted window' });
    }

    // Check for exceptional circumstances
    let exceptionalDetails = {};
    if (exceptionalCircumstances) {
      exceptionalDetails = {
        exceptionalCircumstances: true,
        exceptionDuration: exceptionDuration || 1 // Default to 1 hour if not specified
      };
    }

    // Update or create the attendance record with exceptional circumstances if applicable
    const attendanceRecord = await Attendance.findOneAndUpdate(
      { studentId: student._id, date: timestamp.setHours(0, 0, 0, 0) },
      {
        $push: { checkIns: { time: timestamp, status: status } },
        $setOnInsert: { studentId: student._id, date: timestamp.setHours(0, 0, 0, 0) },
        ...exceptionalDetails
      },
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
  
      // Check if the student is approved
      if (student.status !== 'approved') {
        return res.status(403).json({ message: 'Student not approved for check-out' });
      }
  
      // Authenticate using NFC and/or biometric data here
      let isValidNFC = !nfcTagId || await NFCData.exists({ studentId, tagId: nfcTagId });
       let isValidBiometric = await bcrypt.compare(req.body.biometricData, BiometricData.template);
  
      if (!isValidNFC || !isValidBiometric) {
        return res.status(401).json({ message: 'NFC or biometric authentication failed' });
      }
  
      const timestamp = new Date(currentTime);
      const date = timestamp.setHours(0, 0, 0, 0);
  
      let attendanceRecord = await Attendance.findOne({ studentId: student._id, date: date });
      if (!attendanceRecord) {
        return res.status(400).json({ message: 'No check-in record found for this student on this date' });
      }
  
      // Ensure that we don't record a check-out before a check-in
      if (attendanceRecord.checkIns.length === 0) {
        return res.status(400).json({ message: 'Cannot check out before checking in' });
      }
  
      // Record the check-out
      attendanceRecord.checkOuts.push({ time: timestamp, nfcTagId, biometricData });
      const savedAttendance = await attendanceRecord.save();
      res.status(200).json({ message: 'Check-out recorded successfully', attendanceRecord });
  
    } catch (err) {
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


function updateAttendanceForPeriodicCheck(attendanceRecord, currentTimestamp, classSession) {
  const classStartTime = new Date(classSession.startTime);
  const classEndTime = new Date(classSession.endTime);

  // Handle late check-ins
  const hasLateCheckIn = attendanceRecord.checkIns.some(checkIn => 
      new Date(checkIn.time) > classStartTime
  );

  // Handle early check-outs
  const hasEarlyCheckOut = attendanceRecord.checkOuts.some(checkOut => 
      new Date(checkOut.time) < classEndTime
  );

  // Handle multiple check-ins
  if (attendanceRecord.checkIns.length > 1) {
      const timeFrame = 15 * 60 * 1000; // 15 minutes in milliseconds
      let isIrregular = false;
      for (let i = 0; i < attendanceRecord.checkIns.length - 1; i++) {
          const timeDifference = new Date(attendanceRecord.checkIns[i + 1].time) - new Date(attendanceRecord.checkIns[i].time);
          if (timeDifference <= timeFrame) {
              isIrregular = true;
              break;
          }
      }
      if (isIrregular) {
          attendanceRecord.status = 'Irregular';
      }
  }

  // Default to 'Present' if no late check-in, no early check-out, and not multiple/irregular check-ins
  if (!hasLateCheckIn && !hasEarlyCheckOut && attendanceRecord.status !== 'Irregular') {
      attendanceRecord.status = 'Present';
  }

  // Check for absences if no check-in is recorded
  if (attendanceRecord.checkIns.length === 0 && currentTimestamp > classEndTime) {
      attendanceRecord.status = 'Absent';
  }

  // Adjust attendance status based on exceptional circumstances
  if (attendanceRecord.exceptionalCircumstances && attendanceRecord.exceptionDuration > 0) {
      // Assuming exceptionDuration is in hours, you might want to convert this to your time logic
      // For simplification, marking attendance as 'Present' during exceptional circumstances
      // This is a simplified example. Adjust according to your specific logic and requirements
      attendanceRecord.status = 'Present';
  }
}

  

// ... (recordAndMarkAttendance and performPeriodicCheck methods)

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
        { $match: { 
          studentId: mongoose.Types.ObjectId(classId),
          date: { $gte: start, $lte: end }
        }},
        // Group by student ID and aggregate attendance data
        { $group: {
          _id: "$studentId",
          totalClasses: { $sum: 1 },
          presentCount: { $sum: { $cond: [{ $eq: ["$status", "Present"] }, 1, 0] }},
          lateCount: { $sum: { $cond: [{ $eq: ["$status", "Late"] }, 1, 0] }},
          absentCount: { $sum: { $cond: [{ $eq: ["$status", "Absent"] }, 1, 0] }},
        }},
        // Optional: Join with the StudentDetails collection to get student information
        { $lookup: {
          from: "studentdetails",
          localField: "_id",
          foreignField: "_id",
          as: "studentInfo"
        }},
        // Optional: Format the output
        // { $project: {
        //   totalClasses: 1,
        //   presentCount: 1,
        //   lateCount: 1,
        //   absentCount: 1,
        //   studentInfo: { $arrayElemAt: ["$studentInfo", 0] }, // Extract the first student from the array
        // }}
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
      // Extract month and year from query params or use current date
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
  
      // Calculate the attendance percentage
      const attendancePercentage = (presentDays / totalSessionDays) * 100;
  
      // Respond with the attendance percentage
      res.json({
        studentId,
        month: monthInt,
        year: yearInt,
        attendancePercentage: attendancePercentage.toFixed(2), // Rounds to two decimal places
        details: attendanceRecords
      });
  
    } catch (err) {
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  };
  
  // Helper function to get the total number of session days in a month
  // You need to implement this based on how your timetable data is structured
  async function getSessionDays(startDate, endDate, studentId) {
    // This is a placeholder function
    // You would need to count the actual number of days when sessions are scheduled for the student
    // For now, let's just return an arbitrary number, for example:
    return 20; // Assume there are 20 session days in the month
  }

  
  exports.calculateSemesterAttendance = async (req, res) => {
    try {
      const { studentId } = req.query;
      
      // Replace this with your actual logic to determine the current semester dates
      const currentSemester = getCurrentSemester(new Date()); // You need to define this function
      const semesterStartDate = new Date(currentSemester.startDate);
      const semesterEndDate = new Date(currentSemester.endDate);
  
      // Find all attendance records for the student in the current semester
      const attendanceRecords = await Attendance.find({
        studentId: mongoose.Types.ObjectId(studentId),
        date: { $gte: semesterStartDate, $lte: semesterEndDate }
      });
  
      // Calculate the attendance percentage
      const presentDays = attendanceRecords.filter(record => record.status === 'Present').length;
      const totalDays = attendanceRecords.length; // total days that had sessions in the semester
      const attendancePercentage = (presentDays / totalDays) * 100;
  
      // Respond with the calculated data
      res.json({
        studentId,
        semester: currentSemester.name,
        attendancePercentage,
        details: attendanceRecords
      });
    } catch (err) {
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  };
  

cron.schedule(globalSettings.periodicCheck.interval, performPeriodicCheck);
