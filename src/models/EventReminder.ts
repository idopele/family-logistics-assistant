export interface EventReminder {
  id: string;
  eventId: string;
  /** Occurrence start date in YYYY-MM-DD format. */
  occurrenceDate: string;
  reminderMinutesBefore: 15 | 30 | 60 | 120 | 1440;
  enabled: boolean;
  /** ISO 8601 timestamp. */
  createdAt: string;
  /** ISO 8601 timestamp. */
  updatedAt: string;
}
