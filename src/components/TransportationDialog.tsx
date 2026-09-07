import { useEffect, useState, type FormEvent } from 'react';
import { useUiPreferences, weekDayLabelsByLanguage, type Language } from '../i18n';
import type { Child, ScheduleOccurrence, TransportationConflict, TransportationLeg, TransportationPlan } from '../models';
import { validateTransportationPlanForSave } from '../services/transportationConflictDetection';
import { getDayOfWeek, isValidTime } from '../utils/dateTime';
import { formatDisplayDate } from '../utils/week';

interface TransportationDialogProps {
  occurrence: ScheduleOccurrence | null;
  child: Child | null;
  children: Child[];
  existingPlan: TransportationPlan | null;
  transportationPlans: TransportationPlan[];
  validationOccurrences: ScheduleOccurrence[];
  onClose: () => void;
  onSave: (plan: TransportationPlan) => void;
  onDelete: () => void;
}

export interface TransportationLegFormValues {
  enabled: boolean;
  driverName: string;
  time: string;
  occursNextDay: boolean;
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
  occursNextDay: false,
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
  transportationPlans,
  validationOccurrences,
  onClose,
  onSave,
  onDelete,
}: TransportationDialogProps) {
  const { language, t } = useUiPreferences();
  const [values, setValues] = useState<TransportationFormValues>(() => createInitialTransportationValues(null, null));
  const [error, setError] = useState<string | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [saveConflict, setSaveConflict] = useState<{
    status: 'blocked' | 'warning';
    conflicts: TransportationConflict[];
    plan: TransportationPlan;
  } | null>(null);

  useEffect(() => {
    if (occurrence === null) {
      return;
    }

    setValues(createInitialTransportationValues(occurrence, existingPlan));
    setError(null);
    setIsConfirmingDelete(false);
    setSaveConflict(null);
  }, [existingPlan, occurrence]);

  if (occurrence === null) {
    return null;
  }

  const activeOccurrence = occurrence;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationError = validateTransportationForm(values, language);

    if (validationError !== null) {
      setError(validationError);
      return;
    }

    const draftPlan = buildTransportationPlanFromFormValues(values, activeOccurrence, existingPlan);
    const validationResult = validateTransportationPlanForSave(transportationPlans, draftPlan, validationOccurrences, children);

    if (validationResult.status === 'blocked' || validationResult.status === 'warning') {
      setSaveConflict({ status: validationResult.status, conflicts: validationResult.conflicts, plan: draftPlan });
      return;
    }

    onSave(draftPlan);
    setError(null);
  }

  const dialogDateLabel = getOccurrenceDateLabel(occurrence.date, language);

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="transportation-dialog" role="dialog" aria-modal="true" aria-labelledby="transportation-title">
        <header className="transportation-dialog__header">
          <div>
            <h2 id="transportation-title">{t('transportation')} - {occurrence.title}</h2>
            <p>
              {child?.name ?? occurrence.childId} · {dialogDateLabel}
            </p>
          </div>
          <button className="dialog-close-button" type="button" onClick={onClose}>
            {t('close')}
          </button>
        </header>

        <form className="transportation-form" onSubmit={handleSubmit}>
          <TransportationLegSection
            title={t('outbound')}
            enableLabel={t('planOutbound')}
            driverLabel={t('outboundDriver')}
            timeLabel={t('outboundTime')}
            values={values.outbound}
            children={children}
            onChange={(outbound) => setValues({ ...values, outbound })}
          />
          <TransportationLegSection
            title={t('returnTrip')}
            enableLabel={t('planReturn')}
            driverLabel={t('returnDriver')}
            timeLabel={t('returnTime')}
            values={values.returnTrip}
            children={children}
            onChange={(returnTrip) => setValues({ ...values, returnTrip })}
          />

          {error !== null ? <p className="add-event-form__error">{error}</p> : null}

          {saveConflict !== null ? (
            <TransportationSaveConflictPanel
              status={saveConflict.status}
              conflicts={saveConflict.conflicts}
              onBack={() => setSaveConflict(null)}
              onSaveAnyway={
                saveConflict.status === 'warning'
                  ? () => {
                      onSave(saveConflict.plan);
                      setSaveConflict(null);
                    }
                  : undefined
              }
            />
          ) : null}

          {isConfirmingDelete ? (
            <div className="transportation-dialog__confirm-remove">
              <p>{t('removeTransportationConfirm')}</p>
              <button className="delete-event-dialog__confirm" type="button" onClick={onDelete}>
                {t('removeTransportation')}
              </button>
              <button className="delete-event-dialog__cancel" type="button" onClick={() => setIsConfirmingDelete(false)}>
                {t('cancel')}
              </button>
            </div>
          ) : null}

          <div className="add-event-form__actions">
            <button className="add-event-form__save" type="submit">
              {t('saveTransportation')}
            </button>
            {existingPlan !== null ? (
              <button className="delete-event-dialog__confirm" type="button" onClick={() => setIsConfirmingDelete(true)}>
                {t('removeTransportation')}
              </button>
            ) : null}
            <button className="add-event-form__cancel" type="button" onClick={onClose}>
              {t('cancel')}
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
  const { t } = useUiPreferences();

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
          <label className="checkbox-field transportation-next-day-field">
            <input
              type="checkbox"
              checked={values.occursNextDay}
              onChange={(event) => onChange({ ...values, occursNextDay: event.target.checked })}
            />
            <span>{t('nextDayTransportation')}</span>
          </label>
          <label className="form-field">
            <span>{t('from')}</span>
            <input value={values.from} onChange={(event) => onChange({ ...values, from: event.target.value })} />
          </label>
          <label className="form-field">
            <span>{t('to')}</span>
            <input value={values.to} onChange={(event) => onChange({ ...values, to: event.target.value })} />
          </label>

          <fieldset className="passenger-field form-field--wide">
            <legend>{t('passengers')}</legend>
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
            <span>{t('additionalPassengers')}</span>
            <input
              value={values.additionalPassengers}
              onChange={(event) => onChange({ ...values, additionalPassengers: event.target.value })}
            />
          </label>
          <label className="form-field">
            <span>{t('note')}</span>
            <input value={values.notes} onChange={(event) => onChange({ ...values, notes: event.target.value })} />
          </label>
        </div>
      ) : null}
    </fieldset>
  );
}

function TransportationSaveConflictPanel({
  status,
  conflicts,
  onBack,
  onSaveAnyway,
}: {
  status: 'blocked' | 'warning';
  conflicts: TransportationConflict[];
  onBack: () => void;
  onSaveAnyway?: () => void;
}) {
  const { t } = useUiPreferences();
  const hasExactConflict = status === 'blocked';

  return (
    <section className="transportation-save-conflict" data-status={status}>
      <h3>{hasExactConflict ? t('cannotSaveTransportation') : t('possibleConflictFound')}</h3>
      <p>
        {hasExactConflict
          ? `${conflicts[0]?.first.driverName ?? t('transportation')} ${t('exactConflictSuffix')}`
          : t('warningConflictMessage')}
      </p>
      <div className="transportation-save-conflict__list">
        {conflicts.map((conflict) => (
          <article key={conflict.id} className="transportation-save-conflict__item">
            <strong>{conflict.first.driverName}</strong>
            <ConflictLegLine item={conflict.first} />
            <ConflictLegLine item={conflict.second} />
            <span>{t('gap')} {conflict.minutesApart} {t('minutes')}</span>
          </article>
        ))}
      </div>
      <div className="transportation-save-conflict__actions">
        <button className="delete-event-dialog__cancel" type="button" onClick={onBack}>
          {t('backToEdit')}
        </button>
        {onSaveAnyway !== undefined ? (
          <button className="add-event-form__save" type="button" onClick={onSaveAnyway}>
            {t('saveAnyway')}
          </button>
        ) : null}
      </div>
    </section>
  );
}

function ConflictLegLine({ item }: { item: TransportationConflict['first'] }) {
  const { t } = useUiPreferences();

  return (
    <p>
      {item.time} · {formatPassengerNames(item.childNames, t('additionalPassengers'))} · {item.eventTitle} · {item.direction === 'outbound' ? t('outbound') : t('returnTrip')}
    </p>
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

export function validateTransportationForm(values: TransportationFormValues, language: Language = 'he'): string | null {
  const validation = validationMessages[language];
  const labels = language === 'he' ? { outbound: 'הלוך', returnTrip: 'חזור' } : { outbound: 'outbound ride', returnTrip: 'return ride' };

  if (!values.outbound.enabled && !values.returnTrip.enabled) {
    return validation.legRequired;
  }

  return validateLeg(values.outbound, labels.outbound, validation) ?? validateLeg(values.returnTrip, labels.returnTrip, validation);
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

function validateLeg(values: TransportationLegFormValues, label: string, validation: (typeof validationMessages)['he'] | (typeof validationMessages)['en']): string | null {
  if (!values.enabled) {
    return null;
  }

  if (values.driverName.trim() === '') {
    return `${validation.driverRequired} ${label}.`;
  }

  if (!isValidTime(values.time)) {
    return `${validation.timeRequired} ${label}.`;
  }

  if (values.passengerChildIds.length === 0 && values.additionalPassengers.trim() === '') {
    return `${validation.passengersRequired} ${label}.`;
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
    occursNextDay: values.occursNextDay,
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
    occursNextDay: leg.occursNextDay,
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

function getOccurrenceDateLabel(date: string, language: Language): string {
  const dayLabel = weekDayLabelsByLanguage[language][getDayOfWeek(date)] ?? '';

  return language === 'he' ? `יום ${dayLabel} ${formatDisplayDate(date)}` : `${dayLabel} ${formatDisplayDate(date)}`;
}

function nullableText(value: string): string | null {
  const trimmedValue = value.trim();

  return trimmedValue === '' ? null : trimmedValue;
}

function formatPassengerNames(childNames: string[], emptyLabel: string): string {
  return childNames.length === 0 ? emptyLabel : childNames.join(', ');
}

function createTransportationPlanId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `transport-${crypto.randomUUID()}`;
  }

  return `transport-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const validationMessages = {
  he: {
    legRequired: 'יש לבחור לפחות נסיעת הלוך או חזור.',
    driverRequired: 'יש להזין מי אחראי להסעת',
    timeRequired: 'יש להזין שעה תקינה להסעת',
    passengersRequired: 'יש לבחור נוסעים או להזין נוסעים נוספים להסעת',
  },
  en: {
    legRequired: 'Choose at least an outbound or return ride.',
    driverRequired: 'Enter who is responsible for the',
    timeRequired: 'Enter a valid time for the',
    passengersRequired: 'Choose passengers or enter additional passengers for the',
  },
} as const;
