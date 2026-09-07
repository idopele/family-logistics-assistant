import { useEffect, useState, type FormEvent } from 'react';
import { eventCategories } from '../data/eventCategories';
import type { Child, Event, EventCategory } from '../models';
import { isValidDate, isValidTime } from '../utils/dateTime';

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

  return {
    childId: event.childId,
    category: hasCustomCategoryLabel ? 'custom' : event.category === 'school' ? 'other' : event.category,
    customCategoryLabel: event.customCategoryLabel ?? '',
    title: event.title,
    date: event.date ?? '',
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

  if (!isValidDate(values.date)) {
    return 'יש להזין תאריך תקין.';
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

  return {
    id: eventToEdit?.id ?? createEventId(),
    childId: values.childId,
    title: values.title.trim(),
    category,
    customCategoryLabel,
    date: values.date,
    startTime: values.startTime,
    endTime: values.endTime === '' ? null : values.endTime,
    endsNextDay: values.endTime === '' ? false : values.endsNextDay,
    location: nullableText(values.location),
    notes: nullableText(values.notes),
    recurrence: null,
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

function createEventId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `custom-${crypto.randomUUID()}`;
  }

  return `custom-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
