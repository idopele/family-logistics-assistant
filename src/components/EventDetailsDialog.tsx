import { getEventCategoryLabel } from '../data/eventCategories';
import { useUiPreferences } from '../i18n';
import type { Child, Event, ScheduleOccurrence, TransportationLeg, TransportationPlan } from '../models';

interface EventDetailsDialogProps {
  event: Event | null;
  occurrence: ScheduleOccurrence | null;
  child: Child | null;
  transportationPlan: TransportationPlan | null;
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
}

export function EventDetailsDialog({
  event,
  occurrence,
  child,
  transportationPlan,
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
}: EventDetailsDialogProps) {
  const { language, t } = useUiPreferences();

  if (event === null) {
    return null;
  }

  const details = occurrence ?? event;
  const detailsDate = occurrence?.date ?? event.date;
  const timeLabel = details.endTime === null ? details.startTime : `${details.startTime}-${details.endTime}`;
  const isRecurring = event.recurrence !== null;

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="event-details-dialog" role="dialog" aria-modal="true" aria-labelledby="event-details-title">
        <header className="event-details-dialog__header">
          <h2 id="event-details-title">{details.title}</h2>
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
          <button className="event-details-dialog__close" type="button" onClick={onClose}>
            {t('close')}
          </button>
        </div>
      </section>
    </div>
  );
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
