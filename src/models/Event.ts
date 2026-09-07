import type { EventCategory } from './EventCategory';
import type { RecurrenceRule } from './RecurrenceRule';

export interface Event {
  id: string;
  childId: string;
  title: string;
  category: EventCategory;
  /** YYYY-MM-DD for a one-time event; recurring events may use null. */
  date: string | null;
  /** Required local 24-hour HH:mm start time. */
  startTime: string;
  /** Local 24-hour HH:mm, or null when the end time or duration is not yet known. */
  endTime: string | null;
  /** False means endTime is on the same date; true means endTime is on the following date. */
  endsNextDay: boolean;
  location: string | null;
  notes: string | null;
  recurrence: RecurrenceRule | null;
  requiresTransportation: boolean;
  /** Local 24-hour HH:mm, when applicable. */
  pickupTime: string | null;
  /** Local 24-hour HH:mm, when applicable. */
  dropoffTime: string | null;
  status: 'scheduled' | 'confirmed' | 'changed' | 'cancelled' | 'completed';
  /** ISO 8601 timestamp. */
  createdAt: string;
  /** ISO 8601 timestamp. */
  updatedAt: string;
}
