const express = require('express');
const router = express.Router();
const StudentDetails = require('../models/StudentDetails');

// Assuming FacultyDetails, Department, Class models are defined elsewhere as provided and imported here
const FacultyDetails = require('../models/FacultyDetails');
const User = require('../models/user'); // Make sure you have imported the User model correctly
const { sendEmail } = require('../helpers/emailHelper'); // Ensure you have this function defined to handle email sending

// Function to update or create faculty details for a user
exports.updateFacultyDetails = async (req, res) => {
  const userId = req.user._id; // Using req.user.userId assuming middleware sets this from token
  console.log('user_id',userId)
  const { FacultyName,department, specialization, officeHours, officeLocation, contactEmail, contactPhone, researchInterests } = req.body;

  try {
    // Update or create faculty details with department reference
    const facultyDetails = await FacultyDetails.findOneAndUpdate(
      { user: userId },
      {
        FacultyName,
        department, 
        specialization,
        officeHours,
        officeLocation,
        contactEmail,
        contactPhone,
        researchInterests,
        
      },
      { new: true, upsert: true } // upsert option creates the document if it doesn't exist
    );

    if (!facultyDetails) {
      return res.status(404).json({ message: "Faculty details not found and failed to create." });
    }

    // Send email notification for faculty details update
    const user = await User.findById(userId);
    if (user) {
      const emailSubject = " Faculty Details Have Been Updated";
      const emailBody = `Hello ${FacultyName},

         faculty details have been successfully updated in our system. Here are the updated details for your reference:
        - FacultyName: ${FacultyName}
        - Specialization: ${specialization}
        - Office Hours: ${officeHours}
        - Office Location: ${officeLocation}
        - Contact Email: ${contactEmail}
        - Contact Phone: ${contactPhone}
        - Research Interests: ${researchInterests.join(', ')}
        - Department: ${department}

        If any of this information is incorrect, or if you have any further changes, please contact our administration office as soon as possible.

        Thank you for keeping your information up to date.

        Best regards,
        The Bionite Team`;

      sendEmail(user.email, emailSubject, emailBody);
    }

    res.json({
      message: "Faculty details updated successfully",
      data: facultyDetails,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "An unexpected error occurred while updating faculty details." });
  }
};

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
