export type TransportationConflictSeverity = 'sameTime' | 'closeTiming';

export interface TransportationConflictItem {
  eventId: string;
  occurrenceDate: string;
  effectiveDate: string;
  direction: 'outbound' | 'returnTrip';
  driverName: string;
  time: string;
  eventTitle: string;
  childNames: string[];
}

export interface TransportationConflict {
  id: string;
  normalizedDriverName: string;
  severity: TransportationConflictSeverity;
  minutesApart: number;
  first: TransportationConflictItem;
  second: TransportationConflictItem;
}
