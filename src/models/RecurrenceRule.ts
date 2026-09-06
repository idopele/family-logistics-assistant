export interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly';
  /** Positive integer: repeat every N days, weeks, or months. */
  interval: number;
  /** Weekdays for weekly recurrence: 0 = Sunday, 6 = Saturday. */
  daysOfWeek?: number[];
  /** YYYY-MM-DD. */
  startDate: string;
  /** Inclusive YYYY-MM-DD; omitted or null means no end date. */
  endDate?: string | null;
}
