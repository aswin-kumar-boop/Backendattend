// studentDetailsController.js

const StudentDetails = require('../models/StudentDetails');
const NFCData = require('../models/NFCData');
const BiometricData = require('../models/biometricData');

// POST: Register a new student with pending approval status
exports.registerStudent = async (req, res) => {
    try {
        const studentDetails = new StudentDetails({
            ...req.body,
            status: 'pending_approval',
        });

        const savedDetails = await studentDetails.save();
        res.status(201).json({ message: 'Registration submitted, pending approval.', data: savedDetails });
    } catch (err) {
        res.status(500).json({ message: 'Error during registration', error: err.message });
    }
};

// POST: Approve a student
exports.approveStudent = async (req, res) => {
    try {
        const studentId = req.params.id;

        // Check if the student exists
        const student = await StudentDetails.findById(studentId);
        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        // Check if the student is already approved
        if (student.status === 'approved') {
            return res.status(400).json({ message: 'Student is already approved' });
        }

        // Update the student's status to 'approved'
        student.status = 'approved';
        const updatedStudent = await student.save();

        res.status(200).json({ message: 'Student approved successfully', data: updatedStudent });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// POST: Reject a student
exports.rejectStudent = async (req, res) => {
    try {
        const studentId = req.params.id;

        // Check if the student exists
        const student = await StudentDetails.findById(studentId);
        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        // Check if the student is already rejected
        if (student.status === 'rejected') {
            return res.status(400).json({ message: 'Student is already rejected' });
        }

        // Update the student's status to 'rejected'
        student.status = 'rejected';
        const updatedStudent = await student.save();

        res.status(200).json({ message: 'Student rejected successfully', data: updatedStudent });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.getPendingApprovalStudents = async (req, res) => {
    try {
        const pendingApprovalStudents = await StudentDetails.find({ status: 'pending_approval' });
        res.json(pendingApprovalStudents);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.rejectAndDeleteStudent = async (req, res) => {
    try {
        const studentId = req.params.id;

        // Check if the student exists
        const student = await StudentDetails.findById(studentId);
        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        // Check if the student is pending approval (you can customize this check)
        if (student.status !== 'pending_approval') {
            return res.status(403).json({ message: 'Student cannot be rejected or deleted' });
        }

        // Delete student's NFC data (you may add more data deletion if needed)
        await NFCData.deleteMany({ studentId });

        // Delete student's biometric data (you may add more data deletion if needed)
        await BiometricData.deleteMany({ studentId });

        // Delete the student details
        const deletedDetails = await StudentDetails.findByIdAndDelete(studentId);
        if (!deletedDetails) {
            return res.status(404).json({ message: 'Student not found' });
        }

        res.status(204).send();
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
// POST: Create a new student's details
exports.createStudentDetails = async (req, res) => {
    try {
        const studentDetails = new StudentDetails(req.body);
        const savedDetails = await studentDetails.save();
        res.status(201).json(savedDetails);
    } catch (err) {
        res.status(500).json({ message: err.message });
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
        res.status(201).json(savedNFCData);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// POST: Submit biometric data for a student
exports.submitBiometricData = async (req, res) => {
    try {
        const { studentId, template } = req.body;
        
        // Hash the biometric template before saving
        const hashedTemplate = await hashBiometricData(template);

        const biometricData = new BiometricData({
            studentId,
            template: hashedTemplate // Save the hashed template
        });

        const savedBiometricData = await biometricData.save();
        res.status(201).json({ message: 'Biometric data submitted successfully', data: savedBiometricData });
    } catch (err) {
        res.status(500).json({ message: 'Error while hashing biometric data', error: err.message });
    }
};

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
        res.status(500).json({ message: err.message });
    }
};

// Function to count total students
exports.countTotalStudents = async (req, res) => {
    try {
        const count = await StudentDetails.countDocuments();
        res.json({ totalStudents: count });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Function to count students by status
exports.countStudentsByStatus = async (req, res) => {
    try {
        const pendingApproval = await StudentDetails.countDocuments({ status: 'pending_approval' });
        const approved = await StudentDetails.countDocuments({ status: 'approved' });
        const rejected = await StudentDetails.countDocuments({ status: 'rejected' });

        res.json({
            pendingApproval,
            approved,
            rejected
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
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
        res.status(500).json({ message: err.message });
    }
};

// DELETE: Delete a student's details
exports.deleteStudentDetails = async (req, res) => {
    try {
        const studentId = req.params.id;
        const deletedDetails = await StudentDetails.findByIdAndDelete(studentId);
        if (!deletedDetails) {
            return res.status(404).json({ message: 'Student not found' });
        }
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET: Retrieve all students' details
exports.getAllStudentDetails = async (req, res) => {
    try {
        const details = await StudentDetails.find();
        res.json(details);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Exporting all the functions
// module.exports = {
//     registerStudent,
//     createStudentDetails,
//     submitNFCData,
//     submitBiometricData,
//     getStudentDetails,
//     updateStudentDetails,
//     deleteStudentDetails,
//     getAllStudentDetails
// };
