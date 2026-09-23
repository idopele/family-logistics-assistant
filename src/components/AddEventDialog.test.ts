import { describe, expect, it } from 'vitest';
import { getEventCategoryLabel } from '../data/eventCategories';
import type { Child } from '../models';
import type { Event } from '../models';
import {
  buildEventFromFormValues,
  getAddEventDialogInitializationKey,
  shouldInitializeAddEventDraft,
  type AddEventFormValues,
  validateAddEventForm,
} from './AddEventDialog';

const children: Child[] = [
  {
    id: 'daniel',
    name: 'דניאל',
    color: '#2563EB',
    isActive: true,
  },
  {
    id: 'emanuel',
    name: 'עמנואל',
    color: '#DB2777',
    isActive: true,
  },
];

const validValues: AddEventFormValues = {
  childId: 'daniel',
  category: 'other',
  customCategoryLabel: '',
  title: 'אירוע',
  date: '2026-09-12',
  recurrenceMode: 'oneTime',
  recurrenceStartDate: '2026-09-12',
  recurrenceFrequency: 'weekly',
  recurrenceInterval: '1',
  recurrenceDaysOfWeek: [6],
  recurrenceEndMode: 'none',
  recurrenceEndDate: '',
  startTime: '18:00',
  endTime: '22:00',
  endsNextDay: false,
  reminderMinutesBefore: '',
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

  it('creates a recurring event with date null and a recurrence rule', () => {
    const event = buildEventFromFormValues(
      {
        ...validValues,
        recurrenceMode: 'recurring',
        recurrenceStartDate: '2026-09-13',
        recurrenceFrequency: 'weekly',
        recurrenceInterval: '2',
        recurrenceDaysOfWeek: [0, 3],
        recurrenceEndMode: 'date',
        recurrenceEndDate: '2026-10-31',
      },
      null,
      '2026-09-12T12:00:00.000Z',
    );

    expect(event.date).toBeNull();
    expect(event.recurrence).toEqual({
      frequency: 'weekly',
      interval: 2,
      startDate: '2026-09-13',
      endDate: '2026-10-31',
      daysOfWeek: [0, 3],
    });
  });

  it('stores one participant while preserving childId compatibility', () => {
    const event = buildEventFromFormValues(
      { ...validValues, participantIds: ['daniel'] },
      null,
      '2026-09-12T12:00:00.000Z',
    );

    expect(event.childId).toBe('daniel');
    expect(event.participantIds).toEqual(['daniel']);
  });

  it('stores multiple participants on one event without cloning it', () => {
    const event = buildEventFromFormValues(
      { ...validValues, participantIds: ['daniel', 'emanuel'] },
      null,
      '2026-09-12T12:00:00.000Z',
    );

    expect(event.id).toBeTruthy();
    expect(event.childId).toBe('daniel');
    expect(event.participantIds).toEqual(['daniel', 'emanuel']);
  });

  it('falls back from legacy childId when participantIds is not provided', () => {
    const event = buildEventFromFormValues(validValues, null, '2026-09-12T12:00:00.000Z');

    expect(event.childId).toBe('daniel');
    expect(event.participantIds).toEqual(['daniel']);
  });

  it('requires at least one participant', () => {
    expect(validateAddEventForm({ ...validValues, childId: '', participantIds: [] }, children)).not.toBeNull();
  });

  it('requires at least one weekday for weekly recurring events', () => {
    expect(
      validateAddEventForm(
        {
          ...validValues,
          recurrenceMode: 'recurring',
          recurrenceFrequency: 'weekly',
          recurrenceDaysOfWeek: [],
        },
        children,
      ),
    ).not.toBeNull();
  });

  it('rejects recurring events whose end date is before the start date', () => {
    expect(
      validateAddEventForm(
        {
          ...validValues,
          recurrenceMode: 'recurring',
          recurrenceStartDate: '2026-09-20',
          recurrenceEndMode: 'date',
          recurrenceEndDate: '2026-09-19',
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

describe('AddEventDialog draft initialization', () => {
  it('keeps a create draft stable after parent rerender', () => {
    expect(shouldInitializeAddEventDraft('create', getAddEventDialogInitializationKey(true, null))).toBe(false);
  });

  it('keeps a create draft stable after shared-data refresh while open', () => {
    expect(shouldInitializeAddEventDraft('create', 'create')).toBe(false);
  });

  it('keeps reminder selection in the create draft across refresh rerenders', () => {
    const draft = { ...validValues, reminderMinutesBefore: 30 as const };

    expect(draft.reminderMinutesBefore).toBe(30);
    expect(shouldInitializeAddEventDraft('create', 'create')).toBe(false);
  });

  it('keeps a create draft stable after child list prop refresh', () => {
    const initialKey = getAddEventDialogInitializationKey(true, null);
    const keyAfterChildrenRefresh = getAddEventDialogInitializationKey(true, null);

    expect(shouldInitializeAddEventDraft(initialKey, keyAfterChildrenRefresh)).toBe(false);
  });

  it('keeps a create draft stable after outside filter changes', () => {
    expect(shouldInitializeAddEventDraft('create', getAddEventDialogInitializationKey(true, undefined))).toBe(false);
  });

  it('starts a clean create draft after close and reopen', () => {
    expect(shouldInitializeAddEventDraft(null, getAddEventDialogInitializationKey(true, null))).toBe(true);
  });

  it('initializes when the edit target changes to a different event', () => {
    expect(shouldInitializeAddEventDraft('edit:event-a', 'edit:event-b')).toBe(true);
  });

  it('does not initialize while closed after save clears and closes', () => {
    expect(shouldInitializeAddEventDraft('create', getAddEventDialogInitializationKey(false, null))).toBe(false);
  });

  it('allows cancel to discard the draft by resetting the next open key', () => {
    expect(shouldInitializeAddEventDraft(null, 'create')).toBe(true);
  });
});
