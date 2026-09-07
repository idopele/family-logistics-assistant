import { describe, expect, it } from 'vitest';
import type { Child } from '../models';
import { type AddEventFormValues, validateAddEventForm } from './AddEventDialog';

const children: Child[] = [
  {
    id: 'daniel',
    name: 'דניאל',
    color: '#2563EB',
    isActive: true,
  },
];

const validValues: AddEventFormValues = {
  childId: 'daniel',
  category: 'other',
  title: 'אירוע',
  date: '2026-09-12',
  startTime: '18:00',
  endTime: '22:00',
  endsNextDay: false,
  location: '',
  notes: '',
};

describe('AddEventDialog validation', () => {
  it('accepts a same-day event with endsNextDay false', () => {
    expect(validateAddEventForm(validValues, children)).toBeNull();
  });

  it('accepts an overnight event with endsNextDay true', () => {
    expect(
      validateAddEventForm(
        {
          ...validValues,
          startTime: '23:00',
          endTime: '01:00',
          endsNextDay: true,
        },
        children,
      ),
    ).toBeNull();
  });

  it('rejects an earlier end time when endsNextDay is false', () => {
    expect(
      validateAddEventForm(
        {
          ...validValues,
          startTime: '23:00',
          endTime: '01:00',
          endsNextDay: false,
        },
        children,
      ),
    ).not.toBeNull();
  });

  it('requires endTime when endsNextDay is true', () => {
    expect(
      validateAddEventForm(
        {
          ...validValues,
          endTime: '',
          endsNextDay: true,
        },
        children,
      ),
    ).not.toBeNull();
  });
});
