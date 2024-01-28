const cron = require('node-cron');
const StudentDetails = require('../models/studentDetails');
const NFCData = require('../models/nfcData');
const BiometricData = require('../models/biometricData');
const Attendance = require('../models/attendance');
const Timetable = require('../models/timetable');
const globalSettings = require('../config/globalSettings');
const mongoose = require('mongoose');

// Function to record student attendance for a session
exports.recordSessionAttendance = async (req, res) => {
    try {
        const { studentId, sessionId, checkInTime } = req.body;

        // Validate provided data
        if (!studentId || !sessionId || !checkInTime) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        // Find the student and the session in the timetable
        const student = await StudentDetails.findById(studentId);
        const session = await Timetable.findById(sessionId);

        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        if (!session) {
            return res.status(404).json({ message: 'Session not found' });
        }

        // Determine the type of session (hourly class or 3-hour lab)
        const sessionDuration = (new Date(session.endTime) - new Date(session.startTime)) / (1000 * 60 * 60); // in hours
        const isThreeHourLab = sessionDuration >= 3;

        // Find or create an attendance record for the student on the session's date
        const date = new Date(checkInTime).setHours(0, 0, 0, 0); // reset time to start of the day for consistent querying
        let attendanceRecord = await Attendance.findOne({ studentId: student._id, sessionId: session._id, date });

        if (!attendanceRecord) {
            // If no record exists, create a new one
            attendanceRecord = new Attendance({
                studentId: student._id,
                sessionId: session._id,
                date,
                checkIns: [],
                checkOuts: []
            });
        }

        // Record the check-in
        attendanceRecord.checkIns.push({ time: new Date(checkInTime) });

        // If it's a 3-hour lab, calculate and set the expected check-out time
        if (isThreeHourLab) {
            const expectedCheckOutTime = new Date(checkInTime);
            expectedCheckOutTime.setHours(expectedCheckOutTime.getHours() + 3); // add 3 hours
            attendanceRecord.checkOuts.push({ time: expectedCheckOutTime });
        }

        // Save the updated attendance record
        const savedRecord = await attendanceRecord.save();

        res.status(200).json(savedRecord);
    } catch (err) {
        console.error('Failed to record session attendance:', err);
        res.status(500).json({ message: 'Failed to record session attendance', error: err });
    }
};

// Function to handle student check-in
exports.checkIn = async (req, res) => {
    try {
        const { studentId, nfcTagId, biometricData, currentTime } = req.body;

        // Fetch the student's details
        const student = await StudentDetails.findById(studentId);
        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        // Check if the student is approved
        if (student.status !== 'approved') {
            return res.status(403).json({ message: 'Student not approved for check-in' });
        }

        let isValid = false;
        if (nfcTagId) {
            const nfcRecord = await NFCData.findOne({ studentId, tagId: nfcTagId });
            isValid = !!nfcRecord;
        } else if (biometricData) {
            const biometricRecord = await BiometricData.findOne({ studentId, template: biometricData });
            isValid = !!biometricRecord;
        }

        if (!isValid) {
            return res.status(400).json({ message: 'Invalid NFC or Biometric data' });
        }

        const timestamp = new Date(currentTime);
        const date = new Date(timestamp).setHours(0, 0, 0, 0);

        let attendanceRecord = await Attendance.findOne({ studentId: student._id, date: date });
        if (!attendanceRecord) {
            attendanceRecord = new Attendance({ studentId: student._id, date: date, checkIns: [], checkOuts: [] });
        }

        const currentClass = await Timetable.findOne({
            startTime: { $lte: timestamp },
            endTime: { $gte: timestamp },
        });

        if (currentClass) {
            const classStartTime = new Date(currentClass.startTime);
            const classStartWindow = new Date(classStartTime.getTime() - globalSettings.attendance.checkInWindowMinutes * 60000);

            if (timestamp >= classStartWindow && timestamp <= classStartTime) {
                attendanceRecord.checkIns.push({ time: timestamp, status: 'OnTime' });
            } else if (timestamp > classStartTime && timestamp <= new Date(classStartTime.getTime() + globalSettings.attendance.gracePeriodMinutes * 60000)) {
                attendanceRecord.checkIns.push({ time: timestamp, status: 'Late' });
            } else {
                return res.status(400).json({ message: 'Check-in time is outside the permitted window' });
            }
        } else {
            return res.status(400).json({ message: 'No class scheduled at this time' });
        }

        const savedAttendance = await attendanceRecord.save();
        res.status(200).json(savedAttendance);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Function to handle student check-out
exports.checkOut = async (req, res) => {
    try {
        const { studentId, currentTime } = req.body;

        // Fetch the student's details
        const student = await StudentDetails.findById(studentId);
        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        // Check if the student is approved
        if (student.status !== 'approved') {
            return res.status(403).json({ message: 'Student not approved for check-out' });
        }

        const timestamp = new Date(currentTime);
        const date = new Date(timestamp).setHours(0, 0, 0, 0);

        let attendanceRecord = await Attendance.findOne({ studentId: student._id, date: date });
        if (!attendanceRecord) {
            return res.status(400).json({ message: 'No check-in record found for this student on this date' });
        }

        const currentClass = await Timetable.findOne({
            startTime: { $lte: timestamp },
            endTime: { $gte: timestamp },
        });

        if (currentClass) {
            attendanceRecord.checkOuts.push({ time: timestamp });
        } else {
            return res.status(400).json({ message: 'No class scheduled at this time for check-out' });
        }

        const savedAttendance = await attendanceRecord.save();
        res.status(200).json(savedAttendance);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};


async function performPeriodicCheck() {
    const currentTimestamp = new Date();
    const currentClasses = await Timetable.find({
        startTime: { $lte: currentTimestamp },
        endTime: { $gte: currentTimestamp }
    });

    for (const classSession of currentClasses) {
        const students = await StudentDetails.find({ classId: classSession._id });

        for (const student of students) {
            let attendanceRecord = await Attendance.findOne({
                studentId: student._id,
                date: currentTimestamp.setHours(0, 0, 0, 0)
            });

            if (!attendanceRecord) {
                attendanceRecord = new Attendance({
                    studentId: student._id,
                    date: currentTimestamp.setHours(0, 0, 0, 0),
                    checkIns: [],
                    checkOuts: [],
                    absences: [],  // Assuming this field exists in your model
                    status: 'Absent' // Default status
                });
            }

            // Update attendance status based on the current timestamp and class session
            updateAttendanceForPeriodicCheck(attendanceRecord, currentTimestamp, classSession);

            try {
                await attendanceRecord.save();
            } catch (error) {
                console.error(`Error saving attendance for student ${student._id}:`, error);
            }
        }
    }
}

function updateAttendanceForPeriodicCheck(attendanceRecord, currentTimestamp, classSession) {
    const classStartTime = new Date(classSession.startTime);
    const classEndTime = new Date(classSession.endTime);

    // Handle late check-ins
    const hasLateCheckIn = attendanceRecord.checkIns.some(checkIn => 
        new Date(checkIn.time) > classStartTime
    );

    if (hasLateCheckIn) {
        // Logic to handle late check-ins (e.g., mark as 'Late')
        attendanceRecord.status = 'Late';
    }

    // Handle early check-outs
    const hasEarlyCheckOut = attendanceRecord.checkOuts.some(checkOut => 
        new Date(checkOut.time) < classEndTime
    );

    if (hasEarlyCheckOut) {
        // Logic to handle early check-outs (e.g., mark as 'LeftEarly')
        attendanceRecord.status = 'LeftEarly';
    }

    // Handle multiple check-ins
    const multipleCheckIns = attendanceRecord.checkIns.length > 1;
    if (multipleCheckIns) {
        // Logic for handling multiple check-ins
        // This might include verifying each check-in time
    }

    // Default to 'Present' if no late check-in or early check-out
    if (!hasLateCheckIn && !hasEarlyCheckOut) {
        attendanceRecord.status = 'Present';
    }
}

// ... (recordAndMarkAttendance and performPeriodicCheck methods)

exports.getAttendanceSummary = async (req, res) => {
    try {
        const { classId, startDate, endDate } = req.query;

        // Validate query parameters
        if (!classId || !startDate || !endDate) {
            return res.status(400).json({ message: 'Missing required parameters' });
        }

        const summary = await Attendance.aggregate([
            // Match records within the date range for the specified class
            { $match: { 
                classId: mongoose.Types.ObjectId(classId),
                date: { $gte: new Date(startDate), $lte: new Date(endDate) }
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
            }}
        ]);

        res.json(summary);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.recordSessionAttendance = async (req, res) => {
    try {
        const { studentId, sessionId, checkInTime } = req.body; // sessionId should be provided to identify the correct session

        // Validate provided data
        if (!studentId || !sessionId || !checkInTime) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        // Find the student and the session in the timetable
        const student = await StudentDetails.findById(studentId);
        const session = await Timetable.findById(sessionId);

        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }
        if (!session) {
            return res.status(404).json({ message: 'Session not found' });
        }

        // Determine the type of session (hourly class or 3-hour lab)
        const sessionDuration = (new Date(session.endTime) - new Date(session.startTime)) / (1000 * 60 * 60); // in hours
        const isThreeHourLab = sessionDuration >= 3;

        // Find or create an attendance record for the student on the session's date
        const date = new Date(checkInTime).setHours(0, 0, 0, 0); // reset time to start of the day for consistent querying
        let attendanceRecord = await Attendance.findOne({ studentId: student._id, sessionId: session._id, date });

        if (!attendanceRecord) {
            // If no record exists, create a new one
            attendanceRecord = new Attendance({
                studentId: student._id,
                sessionId: session._id,
                date,
                checkIns: [],
                checkOuts: []
            });
        }

        // Record the check-in
        attendanceRecord.checkIns.push({ time: new Date(checkInTime) });

        // If it's a 3-hour lab, calculate and set the expected check-out time
        if (isThreeHourLab) {
            const expectedCheckOutTime = new Date(checkInTime);
            expectedCheckOutTime.setHours(expectedCheckOutTime.getHours() + 3); // add 3 hours
            attendanceRecord.checkOuts.push({ time: expectedCheckOutTime });
        }

        // Save the updated attendance record
        const savedRecord = await attendanceRecord.save();

        res.status(200).json(savedRecord);
    } catch (err) {
        console.error('Failed to record session attendance:', err);
        res.status(500).json({ message: 'Failed to record session attendance', error: err });
    }
};

exports.calculateMonthlyAttendance = async (req, res) => {
    try {
        // Extract month and year from query params or use current date
        const { month, year, studentId } = req.query;
        const startDate = new Date(year, month - 1, 1); // JS months are 0-indexed
        const endDate = new Date(year, month, 0); // Last day of the month

        // Find all attendance records for the student in the given month
        const attendanceRecords = await Attendance.find({
            studentId: mongoose.Types.ObjectId(studentId),
            date: { $gte: startDate, $lte: endDate }
        });

        // Calculate the attendance percentage
        const presentDays = attendanceRecords.filter(record => record.status === 'Present').length;
        const totalDays = attendanceRecords.length; // total days that had sessions
        const attendancePercentage = (presentDays / totalDays) * 100;

        res.json({
            studentId,
            month,
            year,
            attendancePercentage,
            details: attendanceRecords
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.calculateSemesterAttendance = async (req, res) => {
    try {
        const { studentId } = req.query;
        const currentSemester = getCurrentSemester(new Date());
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

        res.json({
            studentId,
            semester: currentSemester.name,
            attendancePercentage,
            details: attendanceRecords
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

cron.schedule(globalSettings.periodicCheck.interval, performPeriodicCheck);
