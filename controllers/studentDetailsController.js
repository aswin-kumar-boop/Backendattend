const StudentDetails = require('../models/StudentDetails');
const NFCData = require('../models/NFCData');
const BiometricData = require('../models/biometricData');
const middleware = require('../helpers/studentmiddleware');
const User = require('../models/user'); // Adjust the path according to your project structure
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
exports.submitNFCData = async (req, res) => {
    try {
        const { studentId, nfcTagId } = req.body;
        const nfcData = new NFCData({
            studentId,
            tagId: nfcTagId
        });

        const savedNFCData = await nfcData.save();
        // res.status(201).json(savedNFCData);
        res.status(201).json({ message: 'NFC data submitted successfully', data: savedNFCData });
    } catch (err) {
        res.status(500).json({ message: 'Error submitting NFC data', error: err.message });
    }
};

// POST: Submit biometric data for a student
exports.submitBiometricData = async (req, res) => {
    try {
        const { studentId, template } = req.body;

        // Hash the biometric template before saving
        const hashedTemplate = await biometricData(template);

        const biometricData = new BiometricData({
            studentId,
            template: hashedTemplate // Save the hashed template
        });

        const savedBiometricData = await biometricData.save();
        res.status(201).json({ message: 'Biometric data submitted successfully', data: savedBiometricData });
    } catch (err) {
        res.status(500).json({ message: 'Error submitting biometric data', error: err.message });
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
        const studentId = req.params.id;
        const details = await StudentDetails.findById(studentId);
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
        if (student.status !== 'pending_approval') {
            return res.status(403).json({ message: 'Student cannot be rejected or deleted' });
        }

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

// ... (other controller functions)

// Function to count total students
exports.countTotalStudents = async (req, res) => {
    try {
        const count = await StudentDetails.countDocuments();
        res.json({ totalStudents: count });
    } catch (err) {
        res.status(500).json({ message: 'Error counting total students', error: err.message });
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
