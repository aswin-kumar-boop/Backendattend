const StudentDetails = require('../models/StudentDetails');
const NFCData = require('../models/NFCData');
const BiometricData = require('../models/biometricData');
const User = require('../models/user');
const cryptoUtils = require('../helpers/encryption');
const { sendEmail } = require('../helpers/emailHelper');
const Department = require('../models/Department');
const Class = require('../models/Class'); 
const axios = require('axios');
const process = require('process');

// Function to update student details
exports.updateStudentDetails = async (req, res) => {
    const userId = req.user._id; 
    const { name, course, year, section, academicLevel, currentSemester, departmentName, className } = req.body;
  
    try {
        // Find the department and class by their names
        const department = await Department.findOne({ name: departmentName });
        const classObj = await Class.findOne({ name: className });
  
        // Update student details including department and class references
        const studentDetails = await StudentDetails.findOneAndUpdate(
            { user: userId },
            { 
              name, 
              course, 
              year, 
              section, 
              academicLevel, 
              currentSemester, 
              department: department ? department._id : null,
              class: classObj ? classObj._id : null
            },
            { new: true }
        ).populate('department class');
  
        if (!studentDetails) {
            return res.status(404).json({ message: "Student details not found for the given user." });
        }

        // Send email notification for student details update
        const user = await User.findById(userId);
        if (user) {
          const emailSubject = "Your Student Details Have Been Updated";
          const emailBody = `Hello ${name},

            We are pleased to inform you that your student details have been successfully updated in our system. Here are the updated details for your reference:

            - Name: ${name}
            - Course: ${course}
            - Year: ${year}
            - Section: ${section}
            - Academic Level: ${academicLevel}
            - Current Semester: ${currentSemester}
            - Department: ${departmentName}
            - Class: ${className}

            If any of this information is incorrect or if you have any further changes, please contact our administration office as soon as possible.

            Thank you for keeping your information up to date.

            Best regards,
            The Bionite Team`;

                sendEmail(user.email, emailSubject, emailBody);
            }
  
        res.json({
            message: "Student details updated successfully",
            data: studentDetails,
        });
    } catch (err) {
        handleError(res, err, "An unexpected error occurred while updating student details.");
    }
  };
  

// Function to update NFC data for a student
exports.updateNFCData = async (req, res) => {
    try {
        const userId = req.user._id; // Extracted from token by authMiddleware

        const studentDetails = await StudentDetails.findOne({ user: userId });
        if (!studentDetails) {
            return res.status(404).json({ message: "Student details not found." });
        }

        const nfcResponse = await axios.get(`${process.env.FASTAPI_BASE_URL}/read-nfc`);
        const { tagId } = nfcResponse.data;

        const updatedNFCData = await NFCData.findOneAndUpdate(
            { studentob_Id: studentDetails._id },
            { tagId },
            { new: true }
        );

        if (!updatedNFCData) {
            return res.status(404).json({ message: "NFC data record not found." });
        }

        // Send email notification for NFC data update
        const user = await User.findById(userId);
        if (user) {
          const emailSubject = "NFC Data Update Confirmation";
          const emailBody = `Dear Student,

          Your NFC data has been successfully updated in our system as of ${new Date().toLocaleDateString()}. Your new NFC tag ID is: ${tagId}.

          Please, keep this information confidential and do not share your NFC tag ID with others. If you experience any issues accessing facilities or services with your NFC tag, please report it to our technical support team immediately.

          Stay safe,
          The Bionite Team`;

    sendEmail(user.email, emailSubject, emailBody);
}



        res.status(200).json({
            success: true,
            message: "NFC data updated successfully.",
            data: updatedNFCData
        });
    } catch (err) {
        console.error("Error updating NFC data:", err);
        res.status(500).json({ message: "Error updating NFC data." });
    }
};

// Function to update biometric data for a student
exports.updateBiometricData = async (req, res) => {
    try {
        const userId = req.user._id; // Using userId from the authenticated user

        const studentDetails = await StudentDetails.findOne({ user: userId });
        if (!studentDetails) {
            return res.status(404).json({ message: "Student details not found." });
        }

        const bioResponse = await axios.get(`${process.env.FASTAPI_BASE_URL}/read-fingerprint`);
        const { template: biometricTemplate } = bioResponse.data;

        // const encryptedTemplate = cryptoUtils.encrypt(biometricTemplate);

        const updatedBiometricData = await BiometricData.findOneAndUpdate(
            { studentob_Id: studentDetails._id },
            { template: biometricTemplate },
            { new: true }
        );

        if (!updatedBiometricData) {
            return res.status(404).json({ message: "Biometric data record not found." });
        }

        // Send email notification for biometric data update
        const user = await User.findById(userId);
        if (user) {
          const emailSubject = "Biometric Data Update Notification";
          const emailBody = `Hello,

          We are writing to inform you that your biometric data has been updated in our secure system. This update ensures that your identity verification process remains accurate and secure.

          It is part of our continuous effort to enhance security and provide you with safe access to our services.

          If you did not request this update or believe this to be an error, please contact our security department immediately to ensure your data is protected.

          Thank you for your cooperation.

          Best regards,
          The Bionite Team`;

    sendEmail(user.email, emailSubject, emailBody);
}
      
        res.status(200).json({
            success: true,
            message: "Biometric data updated successfully.",
            data: updatedBiometricData
        });
    } catch (err) {
        console.error("Error updating biometric data:", err);
        res.status(500).json({ message: "Error updating biometric data." });
    }
};


// Function to handle data update response
const handleDataUpdateResponse = (res, updatedData, dataType) => {
    if (!updatedData) {
        return res.status(404).json({ message: `${dataType} not found for the given student.` });
    }
    res.json({ message: `${dataType} updated successfully`, data: updatedData });
};

// Function to handle common error
const handleError = (res, err, errorMessage) => {
    console.error(errorMessage, err);
    res.status(500).json({ message: errorMessage });
};

// Function to approve a student and enroll them in the appropriate class
exports.approveStudent = async (req, res) => {
    try {
        const studentId = req.params.id;
        
        const existingStudent = await StudentDetails.findById(studentId);
        if (!existingStudent) {
            return res.status(404).json({ message: 'Student not found' });
        }

        if (existingStudent.status === 'approved') {
            return res.status(400).json({ message: 'Student already approved' });
        }

        // Proceed to update status and enroll in class
        const updatedStudent = await updateStudentStatus(studentId, 'approved', { new: true });

        const department = await Department.findOne({ departmentName: updatedStudent.departmentName});
        if (!department) {
            return res.status(404).json({ message: 'Department not found' });
        }

        const studentClass = await Class.findOne({ department: department._id, year: updatedStudent.year });
        if (!studentClass) {
            return res.status(404).json({ message: 'Class not found for the student' });
        }

        if (studentClass.enrolledStudents.find(student => student._id.toString() === updatedStudent._id.toString())) {
            return res.status(400).json({ message: 'Student already enrolled in this class' });
        }

        if (studentClass.enrolledStudents.length >= 70) {
            return res.status(400).json({ message: 'Class is already full' });
        }

        studentClass.enrolledStudents.push({
            _id: updatedStudent._id,
            studentId: updatedStudent.studentId,
            name: updatedStudent.name,
        });
        await studentClass.save();

        // Assuming sendApprovalRejectionEmail does not directly send a response
        await sendApprovalRejectionEmail(req, res, updatedStudent, 'approved', 'Student Approval', 'Your student account has been approved.');
    } catch (err) {
        handleError(res, err, "Error approving student");
    }
};


// Function to reject a student
exports.rejectStudent = async (req, res) => {
    try {
        const studentId = req.params.id;

        const existingStudent = await StudentDetails.findById(studentId);
        if (!existingStudent) {
            return res.status(404).json({ message: 'Student not found' });
        }

        if (existingStudent.status === 'rejected') {
            return res.status(400).json({ message: 'Student already rejected' });
        }

        const updatedStudent = await updateStudentStatus(studentId, 'rejected', { new: true });

        const classes = await Class.find({ "enrolledStudents._id": updatedStudent._id });
        for (let studentClass of classes) {
            studentClass.enrolledStudents = studentClass.enrolledStudents.filter(student => student._id.toString() !== updatedStudent._id.toString());
            await studentClass.save();
        }

        // Assuming sendApprovalRejectionEmail does not directly send a response
        await sendApprovalRejectionEmail(req, res, updatedStudent, 'rejected', 'Student Rejection', 'Your student account has been rejected.');
    } catch (err) {
        handleError(res, err, "Error rejecting student");
    }
};


// Function to update student status, with improved error handling
const updateStudentStatus = async (studentId, status, errorMessage) => {
    const student = await StudentDetails.findByIdAndUpdate(studentId, { status }, { new: true });
    if (!student) {
        throw new Error(errorMessage);
    }
    return student;
};



// Function to send approval/rejection email to the student
const sendApprovalRejectionEmail = async (req, res, student, status, subject, message) => {
    const user = await User.findById(student.user);
    if (user) {
        sendEmail(user.email, subject, message);
    }
    res.status(200).json({ message: `Student ${status} successfully`, data: student });
};



// GET: Retrieve a student's details by ID
exports.getStudentDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const details = await StudentDetails.findById(id);
        if (!details) {
            return res.status(404).json({ message: 'Student not found' });
        }
        res.json(details);
    } catch (err) {
        res.status(500).json({ message: 'Error retrieving student details', error: err.message });
    }
};



// DELETE: Delete a student's details (with middleware checks)
exports.deleteStudentDetails = async (req, res) => {
    try {
        const student = req.student; // Student object attached by middleware

        // Delete student's NFC and biometric data (using middleware)
        await middleware.deleteStudentData(req, res, async () => {
            // Middleware will handle data deletion, continue with student deletion
            const deletedDetails = await StudentDetails.findByIdAndDelete(student._id);
            if (!deletedDetails) {
                return res.status(404).json({ message: 'Student not found' });
            }
            res.status(204).send();
        });
    } catch (err) {
        res.status(500).json({ message: 'Error deleting student details', error: err.message });
    }
};

// Function to count the total number of students
exports.countTotalStudents = async (req, res) => {
    try {
        const totalStudents = await StudentDetails.countDocuments(); // This will count all student records
        res.json({ total: totalStudents });
    } catch (err) {
        console.error("Error counting total students:", err);
        res.status(500).json({ message: "Error counting total students", error: err.message });
    }
};

// Function to count students by status
exports.countStudentsByStatus = async (req, res) => {
    try {
        const statusCounts = await StudentDetails.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } },
        ]);

        const counts = {};
        statusCounts.forEach((statusCount) => {
            counts[statusCount._id] = statusCount.count;
        });

        res.json(counts);
    } catch (err) {
        res.status(500).json({ message: 'Error counting students by status', error: err.message });
    }
};

// PUT: Update a student's details
exports.updateStudentDetails = async (req, res) => {
    try {
        const studentId = req.params.id;
        const updatedDetails = await StudentDetails.findByIdAndUpdate(studentId, req.body, { new: true });
        if (!updatedDetails) {
            return res.status(404).json({ message: 'Student not found' });
        }
        res.json(updatedDetails);
    } catch (err) {
        res.status(500).json({ message: 'Error updating student details', error: err.message });
    }
};

// GET: Retrieve all students' details
exports.getAllStudentDetails = async (req, res) => {
    try {
        const details = await StudentDetails.find();
        res.json(details);
    } catch (err) {
        res.status(500).json({ message: 'Error retrieving all students details', error: err.message });
    }
};
