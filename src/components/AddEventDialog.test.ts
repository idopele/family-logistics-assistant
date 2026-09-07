import { describe, expect, it } from 'vitest';
import { getEventCategoryLabel } from '../data/eventCategories';
import type { Child } from '../models';
import type { Event } from '../models';
import { buildEventFromFormValues, type AddEventFormValues, validateAddEventForm } from './AddEventDialog';

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
  customCategoryLabel: '',
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

  it('requires a custom activity label when custom category is selected', () => {
    expect(validateAddEventForm({ ...validValues, category: 'custom', customCategoryLabel: '   ' }, children)).not.toBeNull();
  });

  it('stores custom activity type as other with customCategoryLabel', () => {
    const event = buildEventFromFormValues(
      {
        ...validValues,
        category: 'custom',
        customCategoryLabel: 'חוג צילום',
      },
      null,
      '2026-09-12T12:00:00.000Z',
    );

    expect(event).toMatchObject({
      category: 'other',
      customCategoryLabel: 'חוג צילום',
    });
  });

  it('editing custom event updates customCategoryLabel', () => {
    const existingEvent: Event = buildEventFromFormValues(
      { ...validValues, category: 'custom', customCategoryLabel: 'טיפול' },
      null,
      '2026-09-12T12:00:00.000Z',
    );
    const updatedEvent = buildEventFromFormValues(
      { ...validValues, category: 'custom', customCategoryLabel: 'מסיבה' },
      existingEvent,
      '2026-09-12T13:00:00.000Z',
    );

    expect(updatedEvent).toMatchObject({
      id: existingEvent.id,
      category: 'other',
      customCategoryLabel: 'מסיבה',
    });
  });

  it('clears customCategoryLabel when changing a custom event to a predefined category', () => {
    const existingEvent: Event = buildEventFromFormValues(
      { ...validValues, category: 'custom', customCategoryLabel: 'טיפול' },
      null,
      '2026-09-12T12:00:00.000Z',
    );
    const updatedEvent = buildEventFromFormValues({ ...validValues, category: 'work' }, existingEvent, '2026-09-12T13:00:00.000Z');

    expect(updatedEvent).toMatchObject({
      category: 'work',
      customCategoryLabel: null,
    });
  });

  it('displays friends with the updated Hebrew label', () => {
    expect(getEventCategoryLabel({ category: 'friends', customCategoryLabel: null })).toBe('פגישה עם חברים');
  });
});
