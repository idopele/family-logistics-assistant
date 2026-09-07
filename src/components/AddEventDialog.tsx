import { useState, type FormEvent } from 'react';
import { eventCategories } from '../data/eventCategories';
import type { Child, Event, EventCategory } from '../models';
import { isValidDate, isValidTime } from '../utils/dateTime';

interface AddEventDialogProps {
  isOpen: boolean;
  children: Child[];
  onClose: () => void;
  onSave: (event: Event) => void;
}

interface FormValues {
  childId: string;
  category: ManualEventCategory;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  notes: string;
}

type ManualEventCategory = Exclude<EventCategory, 'school'>;

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
  'birthday',
  'exam',
  'transportation',
  'parentMeeting',
  'performance',
  'openPractice',
  'other',
];

const initialValues: FormValues = {
  childId: 'daniel',
  category: 'other',
  title: '',
  date: '',
  startTime: '',
  endTime: '',
  location: '',
  notes: '',
};

export function AddEventDialog({ isOpen, children, onClose, onSave }: AddEventDialogProps) {
  const [values, setValues] = useState<FormValues>(initialValues);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) {
    return null;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationError = validateForm(values, children);

    if (validationError !== null) {
      setError(validationError);
      return;
    }

    const timestamp = new Date().toISOString();
    const nextEvent: Event = {
      id: createEventId(),
      childId: values.childId,
      title: values.title.trim(),
      category: values.category,
      date: values.date,
      startTime: values.startTime,
      endTime: values.endTime === '' ? null : values.endTime,
      location: nullableText(values.location),
      notes: nullableText(values.notes),
      recurrence: null,
      requiresTransportation: false,
      pickupTime: null,
      dropoffTime: null,
      status: 'scheduled',
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    onSave(nextEvent);
    setValues(initialValues);
    setError(null);
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
          <h2 id="add-event-title">הוסף אירוע</h2>
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
              onChange={(event) => setValues({ ...values, category: event.target.value as ManualEventCategory })}
            >
              {manualCategories.map((category) => (
                <option key={category} value={category}>
                  {eventCategories[category]}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span>כותרת</span>
            <input value={values.title} onChange={(event) => setValues({ ...values, title: event.target.value })} />
          </label>

          <label className="form-field">
            <span>תאריך</span>
            <input
              type="date"
              value={values.date}
              onChange={(event) => setValues({ ...values, date: event.target.value })}
            />
          </label>

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
              onChange={(event) => setValues({ ...values, endTime: event.target.value })}
            />
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
              שמור אירוע
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

function validateForm(values: FormValues, children: Child[]): string | null {
  if (values.childId === '' || !children.some((child) => child.id === values.childId)) {
    return 'בחרו ילד.';
  }

  if (values.title.trim() === '') {
    return 'יש להזין כותרת.';
  }

  if (!isValidDate(values.date)) {
    return 'יש להזין תאריך תקין.';
  }

  if (!isValidTime(values.startTime)) {
    return 'יש להזין שעת התחלה תקינה.';
  }

  if (values.endTime !== '' && !isValidTime(values.endTime)) {
    return 'יש להזין שעת סיום תקינה או להשאיר ריק.';
  }

  if (values.endTime !== '' && values.endTime < values.startTime) {
    return 'שעת הסיום לא יכולה להיות מוקדמת משעת ההתחלה.';
  }

  return null;
}

function nullableText(value: string): string | null {
  const trimmedValue = value.trim();

  return trimmedValue === '' ? null : trimmedValue;
}

function createEventId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `custom-${crypto.randomUUID()}`;
  }

  return `custom-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
