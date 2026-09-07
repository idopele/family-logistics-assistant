import { useEffect, useState, type FormEvent } from 'react';
import { useUiPreferences, type Language } from '../i18n';
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
  const { language, t } = useUiPreferences();
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

    const validationError = validateOccurrenceEditForm(values, language);

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
          <h2 id="occurrence-edit-title">{t('editOccurrenceTitle')}</h2>
        </header>
        <form className="add-event-form" onSubmit={handleSubmit}>
          <label className="form-field form-field--wide">
            <span>{t('title')}</span>
            <input value={values.title} onChange={(event) => setValues({ ...values, title: event.target.value })} />
          </label>

          <label className="form-field">
            <span>{t('startTime')}</span>
            <input
              type="time"
              value={values.startTime}
              onChange={(event) => setValues({ ...values, startTime: event.target.value })}
            />
          </label>

          <label className="form-field">
            <span>{t('endTime')}</span>
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
            <span>{t('endsNextDay')}</span>
          </label>

          <label className="form-field">
            <span>{t('location')}</span>
            <input value={values.location} onChange={(event) => setValues({ ...values, location: event.target.value })} />
          </label>

          <label className="form-field form-field--wide">
            <span>{t('notes')}</span>
            <textarea value={values.notes} onChange={(event) => setValues({ ...values, notes: event.target.value })} />
          </label>

          {error !== null ? <p className="add-event-form__error">{error}</p> : null}

          <div className="add-event-form__actions">
            <button className="add-event-form__save" type="submit">
              {t('saveOccurrence')}
            </button>
            <button className="add-event-form__cancel" type="button" onClick={onClose}>
              {t('cancel')}
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

export function validateOccurrenceEditForm(values: OccurrenceEditFormValues, language: Language = 'he'): string | null {
  const validation = validationMessages[language];

  if (values.title.trim() === '') {
    return validation.titleRequired;
  }

  if (!isValidTime(values.startTime)) {
    return validation.startTimeRequired;
  }

  if (values.endsNextDay && values.endTime === '') {
    return validation.overnightEndRequired;
  }

  if (values.endTime !== '' && !isValidTime(values.endTime)) {
    return validation.endTimeInvalid;
  }

  if (!values.endsNextDay && values.endTime !== '' && values.endTime < values.startTime) {
    return validation.endBeforeStart;
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

const validationMessages = {
  he: {
    titleRequired: 'יש להזין כותרת.',
    startTimeRequired: 'יש להזין שעת התחלה תקינה.',
    overnightEndRequired: 'יש להזין שעת סיום לאירוע שמסתיים ביום למחרת.',
    endTimeInvalid: 'יש להזין שעת סיום תקינה או להשאיר ריק.',
    endBeforeStart: 'שעת הסיום לא יכולה להיות מוקדמת משעת ההתחלה.',
  },
  en: {
    titleRequired: 'Enter a title.',
    startTimeRequired: 'Enter a valid start time.',
    overnightEndRequired: 'Enter an end time for an event that ends next day.',
    endTimeInvalid: 'Enter a valid end time or leave it empty.',
    endBeforeStart: 'The end time cannot be earlier than the start time.',
  },
} as const;
