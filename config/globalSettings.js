// Global settings for the attendance application

const settings = {
    // Attendance-specific settings
    attendance: {
        gracePeriodMinutes: 15,  // Grace period for late check-ins
        checkInWindowMinutes: 30, // Time window for allowed check-ins before class starts
    },

    // School or college working hours, holidays, etc.
    school: {
        workingHours: {
            start: '08:00', // Start time (HH:mm format)
            end: '18:00',   // End time (HH:mm format)
        },
        holidays: ['2024-01-01', '2024-12-25'], // List of holidays (YYYY-MM-DD format)
    },

    // Configuration for periodic checks
    periodicCheck: {
        interval: '*/30 * * * *', // Cron format for scheduling periodic checks
    },

    // Other global settings...
};

// const academicSemesters = [
//     {
//         name: 'Fall',
//         startDate: '2024-08-01',
//         endDate: '2024-12-31'
//     },
//     {
//         name: 'Spring',
//         startDate: '2025-01-01',
//         endDate: '2025-05-31'
//     },
//     // Add more semesters as needed
// ];
module.exports = settings;
// academicSemesters