import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Date utility functions using dayjs with UTC and timezone plugins.
 * All internal dates are stored and computed in UTC.
 */
export class DateUtil {
  /**
   * Returns the current UTC timestamp as ISO string.
   */
  static nowISO(): string {
    return dayjs.utc().toISOString();
  }

  /**
   * Returns the current UTC timestamp as UNIX epoch (seconds).
   */
  static nowTimestamp(): number {
    return dayjs.utc().unix();
  }

  /**
   * Converts an ISO string to UNIX epoch (seconds).
   */
  static toTimestamp(iso: string): number {
    return dayjs.utc(iso).unix();
  }

  /**
   * Converts a UNIX epoch (seconds) to ISO string.
   */
  static toISO(timestamp: number): string {
    return dayjs.unix(timestamp).utc().toISOString();
  }

  /**
   * Parses a date string to UTC dayjs instance.
   */
  static toUTC(date: string | Date): dayjs.Dayjs {
    return dayjs.utc(date);
  }

  /**
   * Computes the number of calendar days between two dates (inclusive).
   * Both dates should be ISO strings or Date objects.
   */
  static computeDays(startDate: string, endDate: string): number {
    const start = dayjs.utc(startDate).startOf('day');
    const end = dayjs.utc(endDate).startOf('day');
    return end.diff(start, 'day') + 1;
  }

  /**
   * Checks whether the current time is within the grace period.
   * Grace period = startDate - graceHours.
   * Returns true if now < (startDate - graceHours), meaning the action IS allowed.
   */
  static isWithinGracePeriod(startDate: string, graceHours: number = 24): boolean {
    const deadline = dayjs.utc(startDate).subtract(graceHours, 'hour');
    return dayjs.utc().isBefore(deadline);
  }

  /**
   * Returns the grace period deadline for a given start date.
   */
  static getGraceDeadline(startDate: string, graceHours: number = 24): string {
    return dayjs.utc(startDate).subtract(graceHours, 'hour').toISOString();
  }

  /**
   * Validates that startDate is before endDate.
   */
  static isValidDateRange(startDate: string, endDate: string): boolean {
    return dayjs.utc(startDate).isBefore(dayjs.utc(endDate)) ||
           dayjs.utc(startDate).isSame(dayjs.utc(endDate), 'day');
  }

  /**
   * Checks if two date ranges overlap.
   */
  static rangesOverlap(
    start1: string, end1: string,
    start2: string, end2: string,
  ): boolean {
    const s1 = dayjs.utc(start1);
    const e1 = dayjs.utc(end1);
    const s2 = dayjs.utc(start2);
    const e2 = dayjs.utc(end2);
    return s1.isBefore(e2) && s2.isBefore(e1) ||
           s1.isSame(s2, 'day') || e1.isSame(e2, 'day') ||
           s1.isSame(e2, 'day') || e1.isSame(s2, 'day');
  }
}
