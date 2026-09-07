import { describe, expect, it } from 'vitest';
import type { ScheduleOccurrence } from '../models';
import { buildExceptionFromOccurrenceEdit, validateOccurrenceEditForm, type OccurrenceEditFormValues } from './OccurrenceEditDialog';

const occurrence: ScheduleOccurrence = {
  eventId: 'custom-recurring-a',
  childId: 'daniel',
  date: '2026-09-15',
  title: 'Original title',
  category: 'basketball',
  customCategoryLabel: null,
  startTime: '17:00',
  endTime: '18:00',
  endsNextDay: false,
  location: 'Gym',
  notes: null,
  status: 'scheduled',
  requiresTransportation: false,
  pickupTime: null,
  dropoffTime: null,
  isException: false,
};

const validValues: OccurrenceEditFormValues = {
  title: 'Updated title',
  startTime: '23:00',
  endTime: '01:00',
  endsNextDay: true,
  location: '',
  notes: 'Bring water',
};

describe('OccurrenceEditDialog helpers', () => {
  it('accepts an overnight occurrence edit when endsNextDay is true', () => {
    expect(validateOccurrenceEditForm(validValues)).toBeNull();
  });

  it('rejects an earlier end time when endsNextDay is false', () => {
    expect(validateOccurrenceEditForm({ ...validValues, endsNextDay: false })).not.toBeNull();
  });

  it('requires endTime when endsNextDay is true', () => {
    expect(validateOccurrenceEditForm({ ...validValues, endTime: '' })).not.toBeNull();
  });

  it('builds a modified exception for exactly the occurrence date', () => {
    expect(buildExceptionFromOccurrenceEdit(occurrence, validValues)).toEqual({
      id: 'exception-custom-recurring-a-2026-09-15',
      eventId: 'custom-recurring-a',
      date: '2026-09-15',
      type: 'modified',
      title: 'Updated title',
      startTime: '23:00',
      endTime: '01:00',
      endsNextDay: true,
      location: null,
      notes: 'Bring water',
    });
  });
});
