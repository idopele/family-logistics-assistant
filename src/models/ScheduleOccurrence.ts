import type { Event } from './Event';
import type { EventCategory } from './EventCategory';

export interface ScheduleOccurrence {
  eventId: string;
  childId: string;
  participantIds?: string[];
  date: string;
  title: string;
  category: EventCategory;
  customCategoryLabel: string | null;
  startTime: string;
  endTime: string | null;
  endsNextDay: boolean;
  location: string | null;
  notes: string | null;
  status: Event['status'];
  requiresTransportation: boolean;
  pickupTime: string | null;
  dropoffTime: string | null;
  isException: boolean;
}
