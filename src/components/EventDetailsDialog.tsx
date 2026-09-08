import { useState } from 'react';
import { getEventCategoryLabel } from '../data/eventCategories';
import { useUiPreferences } from '../i18n';
import type { Child, Event, EventReminder, ScheduleOccurrence, TransportationLeg, TransportationPlan } from '../models';
import {
  buildEventDeepLinkUrl,
  formatReminderLabel,
  isReminderMinutesBefore,
  reminderMinuteOptions,
  type ReminderMinutesBefore,
} from '../services/eventReminders';
import { ReminderIndicator } from './ReminderIndicator';

interface EventDetailsDialogProps {
  event: Event | null;
  occurrence: ScheduleOccurrence | null;
  child: Child | null;
  transportationPlan: TransportationPlan | null;
  reminder: EventReminder | null;
  canEditEvent: boolean;
  canEditOccurrence: boolean;
  canEditSeries: boolean;
  canDeleteEvent: boolean;
  canCancelOccurrence: boolean;
  canDeleteSeries: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onEditOccurrence: () => void;
  onCancelOccurrence: () => void;
  onEditSeries: () => void;
  onDeleteSeries: () => void;
  onOpenTransportation: () => void;
  onReminderChange: (minutesBefore: ReminderMinutesBefore | null) => void;
}

export function EventDetailsDialog({
  event,
  occurrence,
  child,
  transportationPlan,
  reminder,
  canEditEvent,
  canEditOccurrence,
  canEditSeries,
  canDeleteEvent,
  canCancelOccurrence,
  canDeleteSeries,
  onClose,
  onEdit,
  onDelete,
  onEditOccurrence,
  onCancelOccurrence,
  onEditSeries,
  onDeleteSeries,
  onOpenTransportation,
  onReminderChange,
}: EventDetailsDialogProps) {
  const { language, t } = useUiPreferences();
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

  if (event === null) {
    return null;
  }

  const details = occurrence ?? event;
  const detailsDate = occurrence?.date ?? event.date;
  const timeLabel = details.endTime === null ? details.startTime : `${details.startTime}-${details.endTime}`;
  const isRecurring = event.recurrence !== null;

  async function handleCopyEventLink() {
    if (occurrence === null) {
      return;
    }

    const link = buildEventDeepLinkUrl(occurrence, window.location.origin);

    try {
      await copyTextToClipboard(link);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('failed');
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="event-details-dialog" role="dialog" aria-modal="true" aria-labelledby="event-details-title">
        <header className="event-details-dialog__header">
          <h2 id="event-details-title">
            {details.title}
            <ReminderIndicator reminder={reminder} />
          </h2>
          <button className="dialog-close-button" type="button" onClick={onClose}>
            {t('close')}
          </button>
        </header>

        <dl className="event-details-list">
          <div>
            <dt>{t('child')}</dt>
            <dd>{child?.name ?? event.childId}</dd>
          </div>
          <div>
            <dt>{t('eventType')}</dt>
            <dd>{getEventCategoryLabel(event, language)}</dd>
          </div>
          {isRecurring ? (
            <div>
              <dt>{t('recurrence')}</dt>
              <dd>{t('recurringEvent')}</dd>
            </div>
          ) : null}
          <div>
            <dt>{t('date')}</dt>
            <dd>{detailsDate}</dd>
          </div>
          <div>
            <dt>{t('startTime')}</dt>
            <dd>
              <span className="event-details-list__time">{timeLabel}</span>
              {details.endsNextDay ? <span className="event-details-list__next-day">{t('nextDay')}</span> : null}
            </dd>
          </div>
          {details.location !== null ? (
            <div>
              <dt>{t('location')}</dt>
              <dd>{details.location}</dd>
            </div>
          ) : null}
          {details.notes !== null ? (
            <div>
              <dt>{t('notes')}</dt>
              <dd>{details.notes}</dd>
            </div>
          ) : null}
        </dl>

        {transportationPlan !== null ? <TransportationDetails plan={transportationPlan} /> : null}

        {occurrence !== null ? (
          <label className="event-details-reminder">
            <span>{t('reminder')}</span>
            <select
              value={reminder?.enabled ? String(reminder.reminderMinutesBefore) : ''}
              onChange={(event) => {
                const value = event.target.value;

                if (value === '') {
                  onReminderChange(null);
                  return;
                }

                const minutesBefore = Number(value);

                if (isReminderMinutesBefore(minutesBefore)) {
                  onReminderChange(minutesBefore);
                }
              }}
            >
              <option value="">{t('noReminder')}</option>
              {reminderMinuteOptions.map((minutesBefore) => (
                <option key={minutesBefore} value={minutesBefore}>
                  {formatReminderLabel(minutesBefore, language)}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="event-details-dialog__actions">
          {canEditOccurrence || canEditSeries || canCancelOccurrence || canDeleteSeries ? (
            <>
              {canEditOccurrence ? (
                <button className="event-details-dialog__edit" type="button" onClick={onEditOccurrence}>
                  {canEditSeries ? t('editOccurrence') : t('editEvent')}
                </button>
              ) : null}
              {canEditSeries ? (
                <button className="event-details-dialog__edit" type="button" onClick={onEditSeries}>
                  {t('editSeries')}
                </button>
              ) : null}
              {canCancelOccurrence ? (
                <button className="event-details-dialog__delete" type="button" onClick={onCancelOccurrence}>
                  {t('cancelOccurrence')}
                </button>
              ) : null}
              {canDeleteSeries ? (
                <button className="event-details-dialog__delete" type="button" onClick={onDeleteSeries}>
                  {t('deleteSeries')}
                </button>
              ) : null}
            </>
          ) : canEditEvent || canDeleteEvent ? (
            <>
              {canEditEvent ? (
                <button className="event-details-dialog__edit" type="button" onClick={onEdit}>
                  {t('editEvent')}
                </button>
              ) : null}
              {canDeleteEvent ? (
                <button className="event-details-dialog__delete" type="button" onClick={onDelete}>
                  {t('deleteEvent')}
                </button>
              ) : null}
            </>
          ) : null}
          <button className="event-details-dialog__transportation" type="button" onClick={onOpenTransportation}>
            {transportationPlan === null ? t('addTransportation') : t('editTransportation')}
          </button>
          {occurrence !== null ? (
            <button className="event-details-dialog__copy" type="button" onClick={() => void handleCopyEventLink()}>
              {t('copyEventLink')}
            </button>
          ) : null}
          <button className="event-details-dialog__close" type="button" onClick={onClose}>
            {t('close')}
          </button>
        </div>
        {copyStatus !== 'idle' ? (
          <p className="event-details-dialog__copy-status">
            {copyStatus === 'copied' ? t('linkCopied') : t('linkCopyFailed')}
          </p>
        ) : null}
      </section>
    </div>
  );
}

async function copyTextToClipboard(value: string): Promise<void> {
  if (navigator.clipboard !== undefined) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();

  const didCopy = document.execCommand('copy');
  document.body.removeChild(textarea);

  if (!didCopy) {
    throw new Error('Clipboard copy failed.');
  }
}

function TransportationDetails({ plan }: { plan: TransportationPlan }) {
  const { t } = useUiPreferences();

  return (
    <section className="event-details-transportation">
      <h3>{t('transportation')}</h3>
      {plan.outbound !== null ? <TransportationLegDetails title={t('outbound')} leg={plan.outbound} /> : null}
      {plan.returnTrip !== null ? <TransportationLegDetails title={t('returnTrip')} leg={plan.returnTrip} /> : null}
    </section>
  );
}

function TransportationLegDetails({ title, leg }: { title: string; leg: TransportationLeg }) {
  const { t } = useUiPreferences();
  const route = formatRoute(leg.from, leg.to, t('notSpecified'));

  return (
    <div className="event-details-transportation__leg">
      <h4>{title}</h4>
      <p>
        {leg.driverName} · {leg.time}
        {leg.occursNextDay ? ` · ${t('nextDay')}` : ''}
      </p>
      {route !== null ? <p>{route}</p> : null}
    </div>
  );
}

function formatRoute(from: string | null, to: string | null, fallback: string): string | null {
  if (from === null && to === null) {
    return null;
  }

  return `${from ?? fallback} -> ${to ?? fallback}`;
}
