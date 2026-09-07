import { useEffect, useState, type FormEvent } from 'react';
import { eventCategories } from '../data/eventCategories';
import type { Child, Event, EventCategory, RecurrenceRule } from '../models';
import { getDayOfWeek, isValidDate, isValidTime } from '../utils/dateTime';
import { weekDayLabels } from '../utils/week';

interface AddEventDialogProps {
  isOpen: boolean;
  children: Child[];
  eventToEdit?: Event | null;
  onClose: () => void;
  onSave: (event: Event) => void;
}

export interface AddEventFormValues {
  childId: string;
  category: ManualCategorySelection;
  customCategoryLabel: string;
  title: string;
  date: string;
  recurrenceMode: 'oneTime' | 'recurring';
  recurrenceStartDate: string;
  recurrenceFrequency: RecurrenceRule['frequency'];
  recurrenceInterval: string;
  recurrenceDaysOfWeek: number[];
  recurrenceEndMode: 'none' | 'date';
  recurrenceEndDate: string;
  startTime: string;
  endTime: string;
  endsNextDay: boolean;
  location: string;
  notes: string;
}

type ManualEventCategory = Exclude<EventCategory, 'school'>;
type ManualCategorySelection = ManualEventCategory | 'custom';

const manualCategories: ManualEventCategory[] = [
  'basketball',
  'dance',
  'privateLesson',
  'scouts',
  'doctor',
  'dentist',
  'haircut',
  'friends',
  'family',
  'work',
  'romanticDate',
  'meal',
  'birthday',
  'exam',
  'transportation',
  'parentMeeting',
  'performance',
  'openPractice',
  'other',
];

const initialValues: AddEventFormValues = {
  childId: 'daniel',
  category: 'other',
  customCategoryLabel: '',
  title: '',
  date: '',
  recurrenceMode: 'oneTime',
  recurrenceStartDate: '',
  recurrenceFrequency: 'weekly',
  recurrenceInterval: '1',
  recurrenceDaysOfWeek: [],
  recurrenceEndMode: 'none',
  recurrenceEndDate: '',
  startTime: '',
  endTime: '',
  endsNextDay: false,
  location: '',
  notes: '',
};

export function AddEventDialog({ isOpen, children, eventToEdit, onClose, onSave }: AddEventDialogProps) {
  const [values, setValues] = useState<AddEventFormValues>(initialValues);
  const [error, setError] = useState<string | null>(null);
  const isEditMode = eventToEdit !== null && eventToEdit !== undefined;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setValues(eventToEdit ? getFormValuesFromEvent(eventToEdit) : getInitialValues(children));
    setError(null);
  }, [children, eventToEdit, isOpen]);

  if (!isOpen) {
    return null;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationError = validateAddEventForm(values, children);

    if (validationError !== null) {
      setError(validationError);
      return;
    }

    const nextEvent = buildEventFromFormValues(values, eventToEdit);

    onSave(nextEvent);
    setValues(initialValues);
    setError(null);
  }

  function handleDateChange(date: string) {
    setValues({
      ...values,
      date,
      recurrenceStartDate: date,
      recurrenceDaysOfWeek: isValidDate(date) ? [getDayOfWeek(date)] : values.recurrenceDaysOfWeek,
    });
  }

  function handleRecurrenceStartDateChange(date: string) {
    setValues({
      ...values,
      date,
      recurrenceStartDate: date,
      recurrenceDaysOfWeek: isValidDate(date) ? [getDayOfWeek(date)] : values.recurrenceDaysOfWeek,
    });
  }

  function toggleWeekday(day: number) {
    const recurrenceDaysOfWeek = values.recurrenceDaysOfWeek.includes(day)
      ? values.recurrenceDaysOfWeek.filter((selectedDay) => selectedDay !== day)
      : [...values.recurrenceDaysOfWeek, day].sort((first, second) => first - second);

    setValues({ ...values, recurrenceDaysOfWeek });
  }

  function handleCancel() {
    setValues(initialValues);
    setError(null);
    onClose();
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="add-event-dialog" role="dialog" aria-modal="true" aria-labelledby="add-event-title">
        <header className="add-event-dialog__header">
          <h2 id="add-event-title">{isEditMode ? 'עריכת אירוע' : 'הוסף אירוע'}</h2>
        </header>
        <form className="add-event-form" onSubmit={handleSubmit}>
          <label className="form-field">
            <span>ילד</span>
            <select value={values.childId} onChange={(event) => setValues({ ...values, childId: event.target.value })}>
              {children.map((child) => (
                <option key={child.id} value={child.id}>
                  {child.name}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span>סוג אירוע</span>
            <select
              value={values.category}
              onChange={(event) => {
                const category = event.target.value as ManualCategorySelection;

                setValues({
                  ...values,
                  category,
                  customCategoryLabel: category === 'custom' ? values.customCategoryLabel : '',
                });
              }}
            >
              {manualCategories.map((category) => (
                <option key={category} value={category}>
                  {eventCategories[category]}
                </option>
              ))}
              <option value="custom">סוג פעילות אחר...</option>
            </select>
          </label>

          {values.category === 'custom' ? (
            <label className="form-field">
              <span>שם סוג הפעילות</span>
              <input
                value={values.customCategoryLabel}
                onChange={(event) => setValues({ ...values, customCategoryLabel: event.target.value })}
              />
            </label>
          ) : null}

          <fieldset className="recurrence-mode-field form-field--wide">
            <legend>חזרתיות:</legend>
            <label>
              <input
                type="radio"
                name="recurrence-mode"
                checked={values.recurrenceMode === 'oneTime'}
                onChange={() => setValues({ ...values, recurrenceMode: 'oneTime' })}
              />
              <span>חד-פעמי</span>
            </label>
            <label>
              <input
                type="radio"
                name="recurrence-mode"
                checked={values.recurrenceMode === 'recurring'}
                onChange={() => {
                  const startDate = values.recurrenceStartDate || values.date;

                  setValues({
                    ...values,
                    recurrenceMode: 'recurring',
                    recurrenceStartDate: startDate,
                    recurrenceDaysOfWeek:
                      values.recurrenceDaysOfWeek.length > 0 || !isValidDate(startDate)
                        ? values.recurrenceDaysOfWeek
                        : [getDayOfWeek(startDate)],
                  });
                }}
              />
              <span>אירוע חוזר</span>
            </label>
          </fieldset>

          <label className="form-field">
            <span>כותרת</span>
            <input value={values.title} onChange={(event) => setValues({ ...values, title: event.target.value })} />
          </label>

          {values.recurrenceMode === 'oneTime' ? (
            <label className="form-field">
              <span>תאריך</span>
              <input type="date" value={values.date} onChange={(event) => handleDateChange(event.target.value)} />
            </label>
          ) : (
            <fieldset className="recurrence-controls form-field--wide">
              <legend>חזרתיות</legend>
              <label className="form-field">
                <span>תאריך התחלה</span>
                <input
                  type="date"
                  value={values.recurrenceStartDate}
                  onChange={(event) => handleRecurrenceStartDateChange(event.target.value)}
                />
              </label>
              <label className="form-field">
                <span>תדירות</span>
                <select
                  value={values.recurrenceFrequency}
                  onChange={(event) => setValues({ ...values, recurrenceFrequency: event.target.value as RecurrenceRule['frequency'] })}
                >
                  <option value="daily">יומי</option>
                  <option value="weekly">שבועי</option>
                  <option value="monthly">חודשי</option>
                </select>
              </label>
              <label className="form-field">
                <span>
                  {values.recurrenceFrequency === 'daily'
                    ? 'כל X ימים'
                    : values.recurrenceFrequency === 'weekly'
                      ? 'כל X שבועות'
                      : 'כל X חודשים'}
                </span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={values.recurrenceInterval}
                  onChange={(event) => setValues({ ...values, recurrenceInterval: event.target.value })}
                />
              </label>
              {values.recurrenceFrequency === 'weekly' ? (
                <fieldset className="weekday-field form-field--wide">
                  <legend>ימי השבוע</legend>
                  <div className="weekday-options">
                    {weekDayLabels.map((label, day) => (
                      <button
                        className="weekday-option"
                        data-selected={values.recurrenceDaysOfWeek.includes(day) ? 'true' : 'false'}
                        key={label}
                        type="button"
                        onClick={() => toggleWeekday(day)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </fieldset>
              ) : null}
              {values.recurrenceFrequency === 'monthly' ? <p className="recurrence-help">חוזר באותו יום בחודש</p> : null}
              <fieldset className="recurrence-end-field form-field--wide">
                <legend>סיום החזרה</legend>
                <label>
                  <input
                    type="radio"
                    name="recurrence-end-mode"
                    checked={values.recurrenceEndMode === 'none'}
                    onChange={() => setValues({ ...values, recurrenceEndMode: 'none', recurrenceEndDate: '' })}
                  />
                  <span>ללא תאריך סיום</span>
                </label>
                <label>
                  <input
                    type="radio"
                    name="recurrence-end-mode"
                    checked={values.recurrenceEndMode === 'date'}
                    onChange={() => setValues({ ...values, recurrenceEndMode: 'date' })}
                  />
                  <span>בתאריך</span>
                </label>
                {values.recurrenceEndMode === 'date' ? (
                  <input
                    type="date"
                    value={values.recurrenceEndDate}
                    onChange={(event) => setValues({ ...values, recurrenceEndDate: event.target.value })}
                  />
                ) : null}
              </fieldset>
            </fieldset>
          )}

          <label className="form-field">
            <span>שעת התחלה</span>
            <input
              type="time"
              value={values.startTime}
              onChange={(event) => setValues({ ...values, startTime: event.target.value })}
            />
          </label>

          <label className="form-field">
            <span>שעת סיום</span>
            <input
              type="time"
              value={values.endTime}
              onChange={(event) =>
                setValues({ ...values, endTime: event.target.value, endsNextDay: event.target.value === '' ? false : values.endsNextDay })
              }
            />
          </label>

          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={values.endsNextDay}
              onChange={(event) => setValues({ ...values, endsNextDay: event.target.checked })}
            />
            <span>מסתיים ביום למחרת</span>
          </label>

          <label className="form-field">
            <span>מיקום</span>
            <input value={values.location} onChange={(event) => setValues({ ...values, location: event.target.value })} />
          </label>

          <label className="form-field form-field--wide">
            <span>הערות</span>
            <textarea value={values.notes} onChange={(event) => setValues({ ...values, notes: event.target.value })} />
          </label>

          {error !== null ? <p className="add-event-form__error">{error}</p> : null}

          <div className="add-event-form__actions">
            <button className="add-event-form__save" type="submit">
              {isEditMode ? 'שמור שינויים' : 'שמור אירוע'}
            </button>
            <button className="add-event-form__cancel" type="button" onClick={handleCancel}>
              ביטול
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function getInitialValues(children: Child[]): AddEventFormValues {
  return {
    ...initialValues,
    childId: children[0]?.id ?? '',
  };
}

function getFormValuesFromEvent(event: Event): AddEventFormValues {
  const hasCustomCategoryLabel =
    event.category === 'other' && event.customCategoryLabel !== null && event.customCategoryLabel.trim() !== '';
  const recurrenceStartDate = event.recurrence?.startDate ?? event.date ?? '';

  return {
    childId: event.childId,
    category: hasCustomCategoryLabel ? 'custom' : event.category === 'school' ? 'other' : event.category,
    customCategoryLabel: event.customCategoryLabel ?? '',
    title: event.title,
    date: event.date ?? recurrenceStartDate,
    recurrenceMode: event.recurrence === null ? 'oneTime' : 'recurring',
    recurrenceStartDate,
    recurrenceFrequency: event.recurrence?.frequency ?? 'weekly',
    recurrenceInterval: String(event.recurrence?.interval ?? 1),
    recurrenceDaysOfWeek:
      event.recurrence?.daysOfWeek ??
      (isValidDate(recurrenceStartDate) ? [getDayOfWeek(recurrenceStartDate)] : []),
    recurrenceEndMode: event.recurrence?.endDate ? 'date' : 'none',
    recurrenceEndDate: event.recurrence?.endDate ?? '',
    startTime: event.startTime,
    endTime: event.endTime ?? '',
    endsNextDay: event.endsNextDay,
    location: event.location ?? '',
    notes: event.notes ?? '',
  };
}

export function validateAddEventForm(values: AddEventFormValues, children: Child[]): string | null {
  if (values.childId === '' || !children.some((child) => child.id === values.childId)) {
    return 'בחרו ילד.';
  }

  if (values.category === 'custom' && values.customCategoryLabel.trim() === '') {
    return 'יש להזין שם סוג פעילות.';
  }

  if (values.title.trim() === '') {
    return 'יש להזין כותרת.';
  }

  if (values.recurrenceMode === 'oneTime' && !isValidDate(values.date)) {
    return 'יש להזין תאריך תקין.';
  }

  if (values.recurrenceMode === 'recurring') {
    if (!isValidDate(values.recurrenceStartDate)) {
      return 'יש להזין תאריך התחלה תקין.';
    }

    const recurrenceInterval = Number(values.recurrenceInterval);

    if (!Number.isInteger(recurrenceInterval) || recurrenceInterval < 1) {
      return 'יש להזין מרווח חזרתיות חיובי.';
    }

    if (values.recurrenceFrequency === 'weekly' && values.recurrenceDaysOfWeek.length === 0) {
      return 'יש לבחור לפחות יום אחד בשבוע.';
    }

    if (values.recurrenceEndMode === 'date') {
      if (!isValidDate(values.recurrenceEndDate)) {
        return 'יש להזין תאריך סיום תקין.';
      }

      if (values.recurrenceEndDate < values.recurrenceStartDate) {
        return 'תאריך הסיום לא יכול להיות לפני תאריך ההתחלה.';
      }
    }
  }

  if (!isValidTime(values.startTime)) {
    return 'יש להזין שעת התחלה תקינה.';
  }

  if (values.endsNextDay && values.endTime === '') {
    return 'יש להזין שעת סיום לאירוע שמסתיים ביום למחרת.';
  }

  if (values.endTime !== '' && !isValidTime(values.endTime)) {
    return 'יש להזין שעת סיום תקינה או להשאיר ריק.';
  }

  if (!values.endsNextDay && values.endTime !== '' && values.endTime < values.startTime) {
    return 'שעת הסיום לא יכולה להיות מוקדמת משעת ההתחלה.';
  }

  return null;
}

export function buildEventFromFormValues(
  values: AddEventFormValues,
  eventToEdit: Event | null = null,
  timestamp = new Date().toISOString(),
): Event {
  const category: EventCategory = values.category === 'custom' ? 'other' : values.category;
  const customCategoryLabel = values.category === 'custom' ? values.customCategoryLabel.trim() : null;
  const recurrence = buildRecurrence(values);

  return {
    id: eventToEdit?.id ?? createEventId(),
    childId: values.childId,
    title: values.title.trim(),
    category,
    customCategoryLabel,
    date: recurrence === null ? values.date : null,
    startTime: values.startTime,
    endTime: values.endTime === '' ? null : values.endTime,
    endsNextDay: values.endTime === '' ? false : values.endsNextDay,
    location: nullableText(values.location),
    notes: nullableText(values.notes),
    recurrence,
    requiresTransportation: false,
    pickupTime: null,
    dropoffTime: null,
    status: 'scheduled',
    createdAt: eventToEdit?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
}

function nullableText(value: string): string | null {
  const trimmedValue = value.trim();

  return trimmedValue === '' ? null : trimmedValue;
}

function buildRecurrence(values: AddEventFormValues): RecurrenceRule | null {
  if (values.recurrenceMode === 'oneTime') {
    return null;
  }

  const recurrence: RecurrenceRule = {
    frequency: values.recurrenceFrequency,
    interval: Number(values.recurrenceInterval),
    startDate: values.recurrenceStartDate,
    endDate: values.recurrenceEndMode === 'date' ? values.recurrenceEndDate : null,
  };

  if (values.recurrenceFrequency === 'weekly') {
    recurrence.daysOfWeek = values.recurrenceDaysOfWeek;
  }

  return recurrence;
}

function createEventId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `custom-${crypto.randomUUID()}`;
  }

  return `custom-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
