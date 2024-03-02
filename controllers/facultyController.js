const express = require('express');
const router = express.Router();
const StudentDetails = require('../models/StudentDetails');

// List Students by Department and optionally by Academic Year
exports.listStudentsByDepartment = async (req, res) => {
    const { departmentId, academicYear } = req.query;
    
    try {
        let query = { department: departmentId };
        if (academicYear) query.year = academicYear;
        
        const students = await StudentDetails.find(query).populate('user', 'username email');
        
        res.status(200).json({
            status: 'success',
            data: students
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: 'error', message: 'An error occurred while fetching student details.' });
    }
};

// Retrieve Student Requests by Year
exports.getStudentRequestsByYear = async (req, res) => {
    const { departmentId, year } = req.query;

    try {
        const studentRequests = await StudentDetails.find({ department: departmentId, year: year, status: 'request' }).populate('user', 'username email');
        
        res.status(200).json({
            status: 'success',
            data: studentRequests
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: 'error', message: 'An error occurred while fetching student requests.' });
    }
};
