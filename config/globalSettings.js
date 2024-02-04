const globalSettings = require('../config/'); // Adjust the path as needed


// Import necessary modules for user input
const readline = require('readline');
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Access global settings
const gracePeriodMinutes = globalSettings.attendance.gracePeriodMinutes;
const checkInWindowMinutes = globalSettings.attendance.checkInWindowMinutes;

// Function to get weekend dates dynamically for the specified year
function getWeekendDates(year) {
    const weekendDates = [];
    for (let month = 1; month <= 12; month++) {
        for (let day = 1; day <= 31; day++) {
            const date = new Date(year, month - 1, day);
            if (date.getDay() === 0 /* Sunday */ || date.getDay() === 6 /* Saturday */) {
                weekendDates.push(date.toISOString().slice(0, 10)); // Format as YYYY-MM-DD
            }
        }
    }
    return weekendDates;
}

// Interactive prompt to set global settings
const settings = {
    // Attendance-specific settings
    attendance: {
        gracePeriodMinutes: 15,  // Default grace period for late check-ins
        checkInWindowMinutes: 30, // Default time window for allowed check-ins before class starts
    },

    // School or college working hours, holidays, weekends, and college strike days
    school: {
        workingHours: {
            start: '08:00', // Default start time (HH:mm format)
            end: '18:00',   // Default end time (HH:mm format)
        },
        holidays: [], // List of holidays (YYYY-MM-DD format)
        weekends: ['Saturday', 'Sunday'], // Default list of weekend days (e.g., 'Saturday', 'Sunday')
        collegeStrikeDays: [], // List of college strike days (YYYY-MM-DD format)
    },

    // Configuration for periodic checks
    periodicCheck: {
        interval: '*/30 * * * *', // Default Cron format for scheduling periodic checks
    },

    // Other global settings...
};

// Function to start the interactive prompt for admin settings
function configureGlobalSettings() {
    rl.question('Enter the grace period in minutes for late check-ins: ', (gracePeriod) => {
        settings.attendance.gracePeriodMinutes = parseInt(gracePeriod);
        rl.question('Enter the check-in window in minutes before class starts: ', (checkInWindow) => {
            settings.attendance.checkInWindowMinutes = parseInt(checkInWindow);
            rl.question('Enter the school working hours start time (HH:mm format): ', (start) => {
                settings.school.workingHours.start = start;
                rl.question('Enter the school working hours end time (HH:mm format): ', (end) => {
                    settings.school.workingHours.end = end;
                    rl.question('Enter the holidays (comma-separated, YYYY-MM-DD format): ', (holidays) => {
                        settings.school.holidays = holidays.split(',').map(date => date.trim());
                        rl.question('Enter the weekend days (comma-separated, e.g., Saturday,Sunday): ', (weekends) => {
                            settings.school.weekends = weekends.split(',').map(day => day.trim());
                            rl.question('Enter the college strike days (comma-separated, YYYY-MM-DD format): ', (strikeDays) => {
                                settings.school.collegeStrikeDays = strikeDays.split(',').map(date => date.trim());
                                rl.question('Enter the Cron format for periodic checks (e.g., */30 * * * *): ', (interval) => {
                                    settings.periodicCheck.interval = interval;
                                    rl.close();

                                    // Export the configured settings
                                    module.exports = settings;
                                });
                            });
                        });
                    });
                });
            });
        });
    });
}

// Start the interactive prompt for admin settings
configureGlobalSettings();

module.exports = settings; // Export the settings object