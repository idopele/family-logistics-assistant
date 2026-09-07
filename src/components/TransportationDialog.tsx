import { useEffect, useState, type FormEvent } from 'react';
import type { Child, ScheduleOccurrence, TransportationLeg, TransportationPlan } from '../models';
import { getDayOfWeek, isValidTime } from '../utils/dateTime';
import { formatDisplayDate, weekDayLabels } from '../utils/week';

interface TransportationDialogProps {
  occurrence: ScheduleOccurrence | null;
  child: Child | null;
  children: Child[];
  existingPlan: TransportationPlan | null;
  onClose: () => void;
  onSave: (plan: TransportationPlan) => void;
  onDelete: () => void;
}

export interface TransportationLegFormValues {
  enabled: boolean;
  driverName: string;
  time: string;
  from: string;
  to: string;
  passengerChildIds: string[];
  additionalPassengers: string;
  notes: string;
}

export interface TransportationFormValues {
  outbound: TransportationLegFormValues;
  returnTrip: TransportationLegFormValues;
}

const emptyLegValues: TransportationLegFormValues = {
  enabled: false,
  driverName: '',
  time: '',
  from: '',
  to: '',
  passengerChildIds: [],
  additionalPassengers: '',
  notes: '',
};

export function TransportationDialog({
  occurrence,
  child,
  children,
  existingPlan,
  onClose,
  onSave,
  onDelete,
}: TransportationDialogProps) {
  const [values, setValues] = useState<TransportationFormValues>(() => createInitialTransportationValues(null, null));
  const [error, setError] = useState<string | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  useEffect(() => {
    if (occurrence === null) {
      return;
    }

    setValues(createInitialTransportationValues(occurrence, existingPlan));
    setError(null);
    setIsConfirmingDelete(false);
  }, [existingPlan, occurrence]);

  if (occurrence === null) {
    return null;
  }

  const activeOccurrence = occurrence;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationError = validateTransportationForm(values);

    if (validationError !== null) {
      setError(validationError);
      return;
    }

    onSave(buildTransportationPlanFromFormValues(values, activeOccurrence, existingPlan));
    setError(null);
  }

  const dialogDateLabel = getOccurrenceDateLabel(occurrence.date);

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="transportation-dialog" role="dialog" aria-modal="true" aria-labelledby="transportation-title">
        <header className="transportation-dialog__header">
          <div>
            <h2 id="transportation-title">הסעה - {occurrence.title}</h2>
            <p>
              {child?.name ?? occurrence.childId} · {dialogDateLabel}
            </p>
          </div>
          <button className="dialog-close-button" type="button" onClick={onClose}>
            סגירה
          </button>
        </header>

        <form className="transportation-form" onSubmit={handleSubmit}>
          <TransportationLegSection
            title="הלוך"
            enableLabel="לתכנן הסעה הלוך"
            driverLabel="מי לוקח?"
            timeLabel="שעת יציאה / איסוף"
            values={values.outbound}
            children={children}
            onChange={(outbound) => setValues({ ...values, outbound })}
          />
          <TransportationLegSection
            title="חזור"
            enableLabel="לתכנן הסעה חזור"
            driverLabel="מי מחזיר?"
            timeLabel="שעת איסוף / חזרה"
            values={values.returnTrip}
            children={children}
            onChange={(returnTrip) => setValues({ ...values, returnTrip })}
          />

          {error !== null ? <p className="add-event-form__error">{error}</p> : null}

          {isConfirmingDelete ? (
            <div className="transportation-dialog__confirm-remove">
              <p>להסיר את פרטי ההסעה לאירוע הזה?</p>
              <button className="delete-event-dialog__confirm" type="button" onClick={onDelete}>
                הסר הסעה
              </button>
              <button className="delete-event-dialog__cancel" type="button" onClick={() => setIsConfirmingDelete(false)}>
                ביטול
              </button>
            </div>
          ) : null}

          <div className="add-event-form__actions">
            <button className="add-event-form__save" type="submit">
              שמור הסעה
            </button>
            {existingPlan !== null ? (
              <button className="delete-event-dialog__confirm" type="button" onClick={() => setIsConfirmingDelete(true)}>
                הסר הסעה
              </button>
            ) : null}
            <button className="add-event-form__cancel" type="button" onClick={onClose}>
              ביטול
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function TransportationLegSection({
  title,
  enableLabel,
  driverLabel,
  timeLabel,
  values,
  children,
  onChange,
}: {
  title: string;
  enableLabel: string;
  driverLabel: string;
  timeLabel: string;
  values: TransportationLegFormValues;
  children: Child[];
  onChange: (values: TransportationLegFormValues) => void;
}) {
  return (
    <fieldset className="transportation-leg">
      <legend>{title}</legend>
      <label className="checkbox-field">
        <input type="checkbox" checked={values.enabled} onChange={(event) => onChange({ ...values, enabled: event.target.checked })} />
        <span>{enableLabel}</span>
      </label>

      {values.enabled ? (
        <div className="transportation-leg__fields">
          <label className="form-field">
            <span>{driverLabel}</span>
            <input value={values.driverName} onChange={(event) => onChange({ ...values, driverName: event.target.value })} />
          </label>
          <label className="form-field">
            <span>{timeLabel}</span>
            <input type="time" value={values.time} onChange={(event) => onChange({ ...values, time: event.target.value })} />
          </label>
          <label className="form-field">
            <span>מאיפה?</span>
            <input value={values.from} onChange={(event) => onChange({ ...values, from: event.target.value })} />
          </label>
          <label className="form-field">
            <span>לאן?</span>
            <input value={values.to} onChange={(event) => onChange({ ...values, to: event.target.value })} />
          </label>

          <fieldset className="passenger-field form-field--wide">
            <legend>נוסעים</legend>
            <div className="passenger-options">
              {children.map((child) => (
                <label className="checkbox-field" key={child.id}>
                  <input
                    type="checkbox"
                    checked={values.passengerChildIds.includes(child.id)}
                    onChange={() => onChange({ ...values, passengerChildIds: togglePassenger(values.passengerChildIds, child.id) })}
                  />
                  <span>{child.name}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="form-field">
            <span>נוסעים נוספים</span>
            <input
              value={values.additionalPassengers}
              onChange={(event) => onChange({ ...values, additionalPassengers: event.target.value })}
            />
          </label>
          <label className="form-field">
            <span>הערה</span>
            <input value={values.notes} onChange={(event) => onChange({ ...values, notes: event.target.value })} />
          </label>
        </div>
      ) : null}
    </fieldset>
  );
}

export function createInitialTransportationValues(
  occurrence: ScheduleOccurrence | null,
  existingPlan: TransportationPlan | null,
): TransportationFormValues {
  if (existingPlan !== null) {
    return {
      outbound: legToFormValues(existingPlan.outbound),
      returnTrip: legToFormValues(existingPlan.returnTrip),
    };
  }

  const passengerChildIds = occurrence === null ? [] : [occurrence.childId];

  return {
    outbound: {
      ...emptyLegValues,
      passengerChildIds,
      to: occurrence?.location ?? '',
    },
    returnTrip: {
      ...emptyLegValues,
      passengerChildIds,
      from: occurrence?.location ?? '',
    },
  };
}

export function validateTransportationForm(values: TransportationFormValues): string | null {
  if (!values.outbound.enabled && !values.returnTrip.enabled) {
    return 'יש לבחור לפחות נסיעת הלוך או חזור.';
  }

  return validateLeg(values.outbound, 'הלוך') ?? validateLeg(values.returnTrip, 'חזור');
}

export function buildTransportationPlanFromFormValues(
  values: TransportationFormValues,
  occurrence: ScheduleOccurrence,
  existingPlan: TransportationPlan | null = null,
  timestamp = new Date().toISOString(),
): TransportationPlan {
  return {
    id: existingPlan?.id ?? createTransportationPlanId(),
    eventId: occurrence.eventId,
    occurrenceDate: occurrence.date,
    outbound: buildLeg(values.outbound),
    returnTrip: buildLeg(values.returnTrip),
    createdAt: existingPlan?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
}

function validateLeg(values: TransportationLegFormValues, label: string): string | null {
  if (!values.enabled) {
    return null;
  }

  if (values.driverName.trim() === '') {
    return `יש להזין מי אחראי להסעת ${label}.`;
  }

  if (!isValidTime(values.time)) {
    return `יש להזין שעה תקינה להסעת ${label}.`;
  }

  if (values.passengerChildIds.length === 0 && values.additionalPassengers.trim() === '') {
    return `יש לבחור נוסעים או להזין נוסעים נוספים להסעת ${label}.`;
  }

  return null;
}

function buildLeg(values: TransportationLegFormValues): TransportationLeg | null {
  if (!values.enabled) {
    return null;
  }

  return {
    enabled: true,
    driverName: values.driverName.trim(),
    time: values.time,
    from: nullableText(values.from),
    to: nullableText(values.to),
    passengerChildIds: values.passengerChildIds,
    additionalPassengers: nullableText(values.additionalPassengers),
    notes: nullableText(values.notes),
  };
}

function legToFormValues(leg: TransportationLeg | null): TransportationLegFormValues {
  if (leg === null) {
    return emptyLegValues;
  }

  return {
    enabled: true,
    driverName: leg.driverName,
    time: leg.time,
    from: leg.from ?? '',
    to: leg.to ?? '',
    passengerChildIds: leg.passengerChildIds,
    additionalPassengers: leg.additionalPassengers ?? '',
    notes: leg.notes ?? '',
  };
}

function togglePassenger(passengerChildIds: string[], childId: string): string[] {
  return passengerChildIds.includes(childId)
    ? passengerChildIds.filter((passengerChildId) => passengerChildId !== childId)
    : [...passengerChildIds, childId];
}

function getOccurrenceDateLabel(date: string): string {
  const dayLabel = weekDayLabels[getDayOfWeek(date)] ?? '';

  return `יום ${dayLabel} ${formatDisplayDate(date)}`;
}

function nullableText(value: string): string | null {
  const trimmedValue = value.trim();

  return trimmedValue === '' ? null : trimmedValue;
}

function createTransportationPlanId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `transport-${crypto.randomUUID()}`;
  }

  return `transport-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
