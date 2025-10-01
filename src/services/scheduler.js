// src/services/scheduler.js
const moment = require('moment-timezone');

class PublishingScheduler {
  constructor() {
    // Default schedule: Mon/Wed/Fri at 9:00 AM Singapore time
    this.defaultSchedule = {
      days: [1, 3, 5], // Monday, Wednesday, Friday (0 = Sunday)
      time: { hour: 9, minute: 0 },
      timezone: 'Asia/Singapore'
    };
  }

  /**
   * Get next available publishing slot
   * @param {Date} fromDate - Start date (default: now)
   * @param {Object} schedule - Custom schedule (optional)
   * @returns {Date} - Next publishing date
   */
  getNextPublishDate(fromDate = new Date(), schedule = null) {
    const sched = schedule || this.defaultSchedule;
    let current = moment(fromDate).tz(sched.timezone);
    
    // Move to next day if time has passed today
    const targetTime = moment(current).set({
      hour: sched.time.hour,
      minute: sched.time.minute,
      second: 0
    });
    
    if (current.isAfter(targetTime)) {
      current.add(1, 'day');
    }
    
    // Find next scheduled day
    let daysChecked = 0;
    while (daysChecked < 7) {
      const dayOfWeek = current.day();
      
      if (sched.days.includes(dayOfWeek)) {
        // Found a scheduled day
        return current.set({
          hour: sched.time.hour,
          minute: sched.time.minute,
          second: 0,
          millisecond: 0
        }).toDate();
      }
      
      current.add(1, 'day');
      daysChecked++;
    }
    
    // Fallback: next occurrence of first scheduled day
    return current.set({
      hour: sched.time.hour,
      minute: sched.time.minute,
      second: 0,
      millisecond: 0
    }).toDate();
  }

  /**
   * Generate publishing schedule for multiple posts
   * @param {number} count - Number of posts
   * @param {Date} startDate - When to start scheduling
   * @param {Object} schedule - Custom schedule
   * @returns {Array<Date>} - Array of publish dates
   */
  generateSchedule(count, startDate = new Date(), schedule = null) {
    const dates = [];
    let currentDate = new Date(startDate);
    
    for (let i = 0; i < count; i++) {
      const publishDate = this.getNextPublishDate(currentDate, schedule);
      dates.push(publishDate);
      
      // Move to next slot (add 1 day after this slot)
      currentDate = moment(publishDate).add(1, 'day').toDate();
    }
    
    return dates;
  }

  /**
   * Calculate time until publication
   * @param {Date} publishDate - Publication date
   * @returns {string} - Human-readable time remaining
   */
  getTimeUntilPublish(publishDate) {
    const now = moment();
    const target = moment(publishDate);
    const duration = moment.duration(target.diff(now));
    
    if (duration.asSeconds() < 0) {
      return 'Past due';
    }
    
    const days = Math.floor(duration.asDays());
    const hours = duration.hours();
    const minutes = duration.minutes();
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }

  /**
   * Format date for display
   * @param {Date} date - Date to format
   * @returns {string} - Formatted date
   */
  formatPublishDate(date) {
    return moment(date).tz(this.defaultSchedule.timezone).format('ddd, MMM D, YYYY [at] h:mm A z');
  }

  /**
   * Create a custom schedule
   * @param {Array<number>} days - Days of week (0-6)
   * @param {number} hour - Hour (0-23)
   * @param {number} minute - Minute (0-59)
   * @param {string} timezone - Timezone
   * @returns {Object} - Schedule object
   */
  createCustomSchedule(days, hour, minute, timezone = 'Asia/Singapore') {
    return {
      days: days,
      time: { hour, minute },
      timezone: timezone
    };
  }

  /**
   * Get all upcoming scheduled posts info
   * @param {Array<Date>} dates - Array of scheduled dates
   * @returns {Array<Object>} - Detailed schedule info
   */
  getScheduleInfo(dates) {
    return dates.map((date, index) => ({
      slot: index + 1,
      date: this.formatPublishDate(date),
      timeUntil: this.getTimeUntilPublish(date),
      isoString: moment(date).toISOString(),
      dayOfWeek: moment(date).format('dddd')
    }));
  }

  /**
   * Validate if a date is in the future
   * @param {Date} date - Date to validate
   * @returns {boolean}
   */
  isValidFutureDate(date) {
    return moment(date).isAfter(moment());
  }

  /**
   * Get common schedule presets
   * @returns {Object} - Schedule presets
   */
  getPresets() {
    return {
      '3x-week-mwf': {
        name: '3x per week (Mon/Wed/Fri)',
        schedule: this.createCustomSchedule([1, 3, 5], 9, 0)
      },
      '2x-week-tf': {
        name: '2x per week (Tue/Thu)',
        schedule: this.createCustomSchedule([2, 4], 9, 0)
      },
      'daily-weekdays': {
        name: 'Daily (Mon-Fri)',
        schedule: this.createCustomSchedule([1, 2, 3, 4, 5], 9, 0)
      },
      'weekly-monday': {
        name: 'Weekly (Monday)',
        schedule: this.createCustomSchedule([1], 9, 0)
      },
      'biweekly-mf': {
        name: 'Bi-weekly (Mon/Fri)',
        schedule: this.createCustomSchedule([1, 5], 9, 0)
      }
    };
  }
}

module.exports = PublishingScheduler;