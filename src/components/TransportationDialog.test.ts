import { describe, expect, it } from 'vitest';
import type { ScheduleOccurrence } from '../models';
import {
  buildTransportationPlanFromFormValues,
  validateTransportationForm,
  type TransportationFormValues,
} from './TransportationDialog';

const occurrence: ScheduleOccurrence = {
  eventId: 'basketball-a',
  childId: 'daniel',
  date: '2026-09-08',
  title: 'אימון כדורסל',
  category: 'basketball',
  customCategoryLabel: null,
  startTime: '17:30',
  endTime: '19:00',
  endsNextDay: false,
  location: 'ראשונים',
  notes: null,
  status: 'scheduled',
  requiresTransportation: false,
  pickupTime: null,
  dropoffTime: null,
  isException: false,
};

const validValues: TransportationFormValues = {
  outbound: {
    enabled: true,
    driverName: ' אבא ',
    time: '16:50',
    occursNextDay: false,
    from: ' הבית ',
    to: ' ראשונים ',
    passengerChildIds: ['daniel'],
    additionalPassengers: '',
    notes: '',
  },
  returnTrip: {
    enabled: false,
    driverName: '',
    time: '',
    occursNextDay: false,
    from: '',
    to: '',
    passengerChildIds: [],
    additionalPassengers: '',
    notes: '',
  },
};

describe('TransportationDialog helpers', () => {
  it('requires at least one enabled leg', () => {
    expect(
      validateTransportationForm({
        ...validValues,
        outbound: { ...validValues.outbound, enabled: false },
      }),
    ).not.toBeNull();
  });

  it('requires driver for enabled leg', () => {
    expect(
      validateTransportationForm({
        ...validValues,
        outbound: { ...validValues.outbound, driverName: '   ' },
      }),
    ).not.toBeNull();
  });

  it('requires valid time for enabled leg', () => {
    expect(
      validateTransportationForm({
        ...validValues,
        outbound: { ...validValues.outbound, time: '25:00' },
      }),
    ).not.toBeNull();
  });

  it('requires child passenger or additional passengers for enabled leg', () => {
    expect(
      validateTransportationForm({
        ...validValues,
        outbound: { ...validValues.outbound, passengerChildIds: [], additionalPassengers: '   ' },
      }),
    ).not.toBeNull();
  });

  it('allows additional passengers without a child passenger', () => {
    expect(
      validateTransportationForm({
        ...validValues,
        outbound: { ...validValues.outbound, passengerChildIds: [], additionalPassengers: 'אמא של נועה' },
      }),
    ).toBeNull();
  });

  it('stores disabled leg as null and trims optional text', () => {
    const plan = buildTransportationPlanFromFormValues(validValues, occurrence, null, '2026-09-08T12:00:00.000Z');

    expect(plan).toMatchObject({
      eventId: 'basketball-a',
      occurrenceDate: '2026-09-08',
      outbound: {
        enabled: true,
        driverName: 'אבא',
        time: '16:50',
        occursNextDay: false,
        from: 'הבית',
        to: 'ראשונים',
        passengerChildIds: ['daniel'],
        additionalPassengers: null,
        notes: null,
      },
      returnTrip: null,
      createdAt: '2026-09-08T12:00:00.000Z',
      updatedAt: '2026-09-08T12:00:00.000Z',
    });
  });
});
