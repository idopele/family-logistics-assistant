export interface TransportationLeg {
  enabled: boolean;
  driverName: string;
  time: string;
  occursNextDay: boolean;
  from: string | null;
  to: string | null;
  passengerChildIds: string[];
  additionalPassengers: string | null;
  notes: string | null;
}

export interface TransportationPlan {
  id: string;
  eventId: string;
  occurrenceDate: string;
  outbound: TransportationLeg | null;
  returnTrip: TransportationLeg | null;
  createdAt: string;
  updatedAt: string;
}
