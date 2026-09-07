import { useEffect, useState, type FormEvent } from 'react';
import type { EventException, ScheduleOccurrence } from '../models';
import { isValidTime } from '../utils/dateTime';

interface OccurrenceEditDialogProps {
  occurrence: ScheduleOccurrence | null;
  onClose: () => void;
  onSave: (exception: EventException) => void;
}

export interface OccurrenceEditFormValues {
  title: string;
  startTime: string;
  endTime: string;
  endsNextDay: boolean;
  location: string;
  notes: string;
}

const initialValues: OccurrenceEditFormValues = {
  title: '',
  startTime: '',
  endTime: '',
  endsNextDay: false,
  location: '',
  notes: '',
};

export function OccurrenceEditDialog({ occurrence, onClose, onSave }: OccurrenceEditDialogProps) {
  const [values, setValues] = useState<OccurrenceEditFormValues>(initialValues);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (occurrence === null) {
      return;
    }

    setValues(getFormValuesFromOccurrence(occurrence));
    setError(null);
  }, [occurrence]);

  if (occurrence === null) {
    return null;
  }

  const activeOccurrence = occurrence;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationError = validateOccurrenceEditForm(values);

    if (validationError !== null) {
      setError(validationError);
      return;
    }

    onSave(buildExceptionFromOccurrenceEdit(activeOccurrence, values));
    setError(null);
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="add-event-dialog" role="dialog" aria-modal="true" aria-labelledby="occurrence-edit-title">
        <header className="add-event-dialog__header">
          <h2 id="occurrence-edit-title">עריכת המופע הזה</h2>
        </header>
        <form className="add-event-form" onSubmit={handleSubmit}>
          <label className="form-field form-field--wide">
            <span>כותרת</span>
            <input value={values.title} onChange={(event) => setValues({ ...values, title: event.target.value })} />
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
              שמור שינוי למופע
            </button>
            <button className="add-event-form__cancel" type="button" onClick={onClose}>
              ביטול
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export function getFormValuesFromOccurrence(occurrence: ScheduleOccurrence): OccurrenceEditFormValues {
  return {
    title: occurrence.title,
    startTime: occurrence.startTime,
    endTime: occurrence.endTime ?? '',
    endsNextDay: occurrence.endsNextDay,
    location: occurrence.location ?? '',
    notes: occurrence.notes ?? '',
  };
}

export function validateOccurrenceEditForm(values: OccurrenceEditFormValues): string | null {
  if (values.title.trim() === '') {
    return 'יש להזין כותרת.';
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

export function buildExceptionFromOccurrenceEdit(
  occurrence: ScheduleOccurrence,
  values: OccurrenceEditFormValues,
): EventException {
  return {
    id: `exception-${occurrence.eventId}-${occurrence.date}`,
    eventId: occurrence.eventId,
    date: occurrence.date,
    type: 'modified',
    title: values.title.trim(),
    startTime: values.startTime,
    endTime: values.endTime === '' ? null : values.endTime,
    endsNextDay: values.endTime === '' ? false : values.endsNextDay,
    location: nullableText(values.location),
    notes: nullableText(values.notes),
  };
}

function nullableText(value: string): string | null {
  const trimmedValue = value.trim();

  return trimmedValue === '' ? null : trimmedValue;
}
