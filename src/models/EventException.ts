export interface EventException {
  id: string;
  eventId: string;
  /** Original occurrence date in YYYY-MM-DD format. */
  date: string;
  type: 'cancelled' | 'modified';
  title?: string;
  /** Replacement local time in HH:mm format. */
  startTime?: string;
  /** Replacement local time in HH:mm format; null explicitly clears an existing end time. */
  endTime?: string | null;
  endsNextDay?: boolean;
  /** Omitted keeps the original value; null clears it. */
  location?: string | null;
  /** Omitted keeps the original value; null clears it. */
  notes?: string | null;
}
