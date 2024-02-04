const { Parser } = require('json2csv');
const StudentDetails = require('../models/StudentDetails');
const Attendance = require('../models/attendance'); // Assuming you have an Attendance model

exports.generateAttendanceReport = async (req, res) => {
    try {
        const attendanceData = await Attendance.find().populate('studentId', 'name').lean();
        const fields = ['studentId.name', 'date', 'status']; // Customize these fields based on your Attendance model
        const json2csvParser = new Parser({ fields });
        const csv = json2csvParser.parse(attendanceData);

        res.header('Content-Type', 'text/csv');
        res.attachment('attendanceReport.csv');
        return res.send(csv);
    } catch (err) {
        return res.status(500).json({ message: 'Error generating attendance report', error: err.message });
    }
};
