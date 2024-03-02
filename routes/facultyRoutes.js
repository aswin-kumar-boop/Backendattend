const facultyController = require('./facultyController');

// Example usage
router.get('/students', facultyController.listStudentsByDepartment);
router.get('/student-requests', facultyController.getStudentRequestsByYear);
