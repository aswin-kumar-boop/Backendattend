const StudentDetails = require('../models/StudentDetails');
const NFCData = require('../models/NFCData');
const BiometricData = require('../models/biometricData');
const middleware = require('../helpers/studentmiddleware');
const User = require('../models/user'); // Adjust the path according to your project structure
const { sendEmail } = require('../helpers/emailHelper');
//const upload = require('../helpers/uploadMiddleware').single('photo'); // Adjust the path as necessary

// Function to update student details
exports.updateStudentDetails = async (req, res) => {
    const userId = req.user.userId; // Assuming req.user is populated from your authentication middleware
    const { name, course, year, section, academicLevel, currentSemester } = req.body;
  
    // Validate input data (example: check if required fields are provided)
    if (!name || !course || !year || !section || !academicLevel) {
      return res.status(400).json({ message: "Missing required fields." });
    }
  
    try {
      // Attempt to find the StudentDetails document linked to the user
      const studentDetails = await StudentDetails.findByIdAndUpdate({ user: userId });
  
      if (!studentDetails) {
        return res.status(404).json({ message: "Student details not found for the given user." });
      }
  
      // If found, update the student details
      studentDetails.name = name;
      studentDetails.course = course;
      studentDetails.year = year;
      studentDetails.section = section;
      studentDetails.academicLevel = academicLevel;
      studentDetails.currentSemester = currentSemester || studentDetails.currentSemester; // Example of optional field
  
      await studentDetails.save();

      res.json({
        message: "Student details updated successfully",
        data: studentDetails,
      });
    } catch (err) {
      // Log the error for server monitoring
      console.error("Failed to update student details:", err);
  
      // Handle specific error types here if needed
      if (err.name === 'ValidationError') {
        return res.status(400).json({ message: "Validation error: " + err.message });
      }
  
      // Fallback error message
      res.status(500).json({ message: "An unexpected error occurred while updating student details." });
    }
  };


// POST: Submit NFC data for a student
// Function to update NFC data for a student
exports.updateNFCData = async (req, res) => {
    try {
      const { studentId, tagId } = req.body; // Assume tagId is the new NFC data
  
      // Find the StudentDetails document to get the ObjectId
      const studentDetails = await StudentDetails.findOne({ studentId });
      if (!studentDetails) {
        return res.status(404).json({ message: "Student details not found." });
      }
  
      // Update the NFCData document with the new tagId
      const updatedNFCData = await NFCData.findOneAndUpdate(
        { studentob_Id: studentDetails._id },
        { tagId },
        { new: true }
      );
  
      if (!updatedNFCData) {
        return res.status(404).json({ message: "NFC data not found for the given student." });
      }
  
      res.json({ message: "NFC data updated successfully", data: updatedNFCData });
    } catch (err) {
      console.error("Error updating NFC data:", err);
      res.status(500).json({ message: "Error updating NFC data." });
    }
  };
  

// POST: Submit biometric data for a student
// Function to update Biometric data for a student
exports.updateBiometricData = async (req, res) => {
    try {
      const { studentId, template } = req.body; // Assume template is the new biometric data
  
      // Find the StudentDetails document to get the ObjectId
      const studentDetails = await StudentDetails.findOne({ studentId });
      if (!studentDetails) {
        return res.status(404).json({ message: "Student details not found." });
      }
  
      // Update the BiometricData document with the new template
      const updatedBiometricData = await BiometricData.findOneAndUpdate(
        { studentob_Id: studentDetails._id },
        { template },
        { new: true }
      );
  
      if (!updatedBiometricData) {
        return res.status(404).json({ message: "Biometric data not found for the given student." });
      }
  
      res.json({ message: "Biometric data updated successfully", data: updatedBiometricData });
    } catch (err) {
      console.error("Error updating Biometric data:", err);
      res.status(500).json({ message: "Error updating Biometric data." });
    }
  };
  

// // POST: Register a new student with pending approval status
// exports.registerStudent = async (req, res) => {
//     try {
//         const studentDetails = new StudentDetails({
//             ...req.body,
//             status: 'pending_approval',
//         });

//         const savedDetails = await studentDetails.save();
//         res.status(201).json({ message: 'Registration submitted, pending approval.', data: savedDetails });
//     } catch (err) {
//         res.status(500).json({ message: 'Error during registration', error: err.message });
//     }
// };

// POST: Approve a student
exports.approveStudent = async (req, res) => {
    try {
        // Correctly extract the student ID from the URL parameter
        const studentId = req.params.id;

        // Log for debugging
        console.log("Attempting to approve student with ID:", studentId);
        const student = await StudentDetails.findByIdAndUpdate(studentId);
        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        // Check if the student is already rejected
        if (student.status === 'approved') {
            return res.status(400).json({ message: 'Student is already approved' });
        }

        // Find the student and update status to 'approved'
        const updatedStudent = await StudentDetails.findByIdAndUpdate(
            studentId, 
            { status: 'approved' }, 
            { new: true }
        );

        if (!updatedStudent) {
            return res.status(404).json({ message: 'Student not found' });
        }
        // Send an email notification to the student
        const user = await User.findById(student.user);
        if (user) {
        sendEmail(user.email, "Student Approval", "Your student account has been approved.");
    }

        res.status(200).json({ message: 'Student approved successfully', data: updatedStudent });
    } catch (err) {
        res.status(500).json({ message: 'Error approving student', error: err.message });
    }
};

// POST: Approve a student
exports.rejectStudent = async (req, res) => {
    try {
        // Correctly extract the student ID from the URL parameter
        const studentId = req.params.id;

        // Log for debugging
        console.log("Attempting to approve student with ID:", studentId);

        const student = await StudentDetails.findByIdAndUpdate(studentId);
        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        // Check if the student is already rejected
        if (student.status === 'rejected') {
            return res.status(400).json({ message: 'Student is already rejected' });
        }

        // Find the student and update status to 'approved'
        const updatedStudent = await StudentDetails.findByIdAndUpdate(
            studentId, 
            { status: 'rejected' }, 
            { new: true }
        );

        if (!updatedStudent) {
            return res.status(404).json({ message: 'Student not found' });
        }
        // Send an email notification to the student
       const user = await User.findByIdAndUpdate(student.user);
       if (user) {
       sendEmail(user.email, "Student Rejection", "Your student account has been rejected.");
    }

        res.status(200).json({ message: 'Student rejected successfully', data: updatedStudent });
    } catch (err) {
        res.status(500).json({ message: 'Error recejing student', error: err.message });
    }
};



// // POST: Reject a student
// exports.rejectStudent = async (req, res) => {
//     try {
//         const studentId = req.params.id;
        
//         // Check if the student exists
//         const student = await StudentDetails.findByIdAndUpdate(studentId);
//         if (!student) {
//             return res.status(404).json({ message: 'Student not found' });
//         }

//         // Check if the student is already rejected
//         if (student.status === 'rejected') {
//             return res.status(400).json({ message: 'Student is already rejected' });
//         }

//         // Update the student's status to 'rejected'
//         student.status = 'rejected';
//         const updatedStudent = await student.save();

//         res.status(200).json({ message: 'Student rejected successfully', data: updatedStudent });
//     } catch (err) {
//         res.status(500).json({ message: 'Error rejecting student', error: err.message });
//     }
// };

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

        // Check if the student is pending approval (using middleware)
        // if (student.status !== 'pending_approval') {
        //     return res.status(403).json({ message: 'Student cannot be rejected or deleted' });
        // }

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
