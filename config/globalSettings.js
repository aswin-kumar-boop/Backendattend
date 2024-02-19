module.exports = {
    timetable:{
      TotalDuration: 6,
    },
    attendance: {
      checkInWindowMinutes: 15, // Time before class starts when check-ins are allowed
      gracePeriodMinutes: 10, // Time after class starts when a student is considered late but not absent
      minimumSessionDurationMinutes: 45, // Minimum duration a student must stay in a session to be considered attended
    },
    periodicCheck: {
      interval: '0 */1 * * *', // Cron schedule string for periodic checks, e.g., every hour
    },
    calendar: {
      holidays: [
        '2024-01-01', // New Year's Day
        '2024-07-04', // Independence Day
        // Add other fixed or calculated holiday dates
      ],
      strikeDays: [
        // List dates when strikes are occurring
        // '2024-02-14', Example
      ],
      weekends: {
        // Define which days of the week are considered weekends
        saturday: true,
        sunday: true,
      },
    },
    isNonWorkingDay: function(date) {
      const dateString = date.toISOString().split('T')[0]; // Format as 'YYYY-MM-DD'
      const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  
      // Check for holidays and strikes
      if (this.calendar.holidays.includes(dateString) || this.calendar.strikeDays.includes(dateString)) {
        return true;
      }
  
      // Check for weekends
      if ((dayOfWeek === 0 && this.calendar.weekends.sunday) || 
          (dayOfWeek === 6 && this.calendar.weekends.saturday)) {
        return true;
      }
  
      // Not a holiday, strike day, or weekend
      return false;
    }
  };
  