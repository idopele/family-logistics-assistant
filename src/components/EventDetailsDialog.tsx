import { getEventCategoryLabel } from '../data/eventCategories';
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
            סגירה
          </button>
        </header>

        <dl className="event-details-list">
          <div>
            <dt>ילד</dt>
            <dd>{child?.name ?? event.childId}</dd>
          </div>
          <div>
            <dt>סוג</dt>
            <dd>{getEventCategoryLabel(event)}</dd>
          </div>
          {isRecurring ? (
            <div>
              <dt>חזרתיות</dt>
              <dd>אירוע חוזר</dd>
            </div>
          ) : null}
          <div>
            <dt>תאריך</dt>
            <dd>{detailsDate}</dd>
          </div>
          <div>
            <dt>שעה</dt>
            <dd>
              <span className="event-details-list__time">{timeLabel}</span>
              {details.endsNextDay ? <span className="event-details-list__next-day">למחרת</span> : null}
            </dd>
          </div>
          {details.location !== null ? (
            <div>
              <dt>מיקום</dt>
              <dd>{details.location}</dd>
            </div>
          ) : null}
          {details.notes !== null ? (
            <div>
              <dt>הערות</dt>
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
                  {canEditSeries ? 'עריכת המופע הזה' : 'עריכת האירוע'}
                </button>
              ) : null}
              {canEditSeries ? (
                <button className="event-details-dialog__edit" type="button" onClick={onEditSeries}>
                  עריכת כל הסדרה
                </button>
              ) : null}
              {canCancelOccurrence ? (
                <button className="event-details-dialog__delete" type="button" onClick={onCancelOccurrence}>
                  ביטול האירוע בתאריך הזה
                </button>
              ) : null}
              {canDeleteSeries ? (
                <button className="event-details-dialog__delete" type="button" onClick={onDeleteSeries}>
                  מחיקת כל הסדרה
                </button>
              ) : null}
            </>
          ) : canEditEvent || canDeleteEvent ? (
            <>
              {canEditEvent ? (
                <button className="event-details-dialog__edit" type="button" onClick={onEdit}>
                  עריכת האירוע
                </button>
              ) : null}
              {canDeleteEvent ? (
                <button className="event-details-dialog__delete" type="button" onClick={onDelete}>
                  מחיקת אירוע
                </button>
              ) : null}
            </>
          ) : null}
          <button className="event-details-dialog__transportation" type="button" onClick={onOpenTransportation}>
            {transportationPlan === null ? '+ הוסף הסעה' : 'עריכת הסעה'}
          </button>
          <button className="event-details-dialog__close" type="button" onClick={onClose}>
            סגירה
          </button>
        </div>
      </section>
    </div>
  );
}

function TransportationDetails({ plan }: { plan: TransportationPlan }) {
  return (
    <section className="event-details-transportation">
      <h3>הסעה</h3>
      {plan.outbound !== null ? <TransportationLegDetails title="הלוך" leg={plan.outbound} /> : null}
      {plan.returnTrip !== null ? <TransportationLegDetails title="חזור" leg={plan.returnTrip} /> : null}
    </section>
  );
}

function TransportationLegDetails({ title, leg }: { title: string; leg: TransportationLeg }) {
  const route = formatRoute(leg.from, leg.to);

  return (
    <div className="event-details-transportation__leg">
      <h4>{title}</h4>
      <p>
        {leg.driverName} · {leg.time}
        {leg.occursNextDay ? ' · למחרת' : ''}
      </p>
      {route !== null ? <p>{route}</p> : null}
    </div>
  );
}

function formatRoute(from: string | null, to: string | null): string | null {
  if (from === null && to === null) {
    return null;
  }

  return `${from ?? 'לא צוין'} -> ${to ?? 'לא צוין'}`;
}
