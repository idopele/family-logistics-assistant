import { getEventCategoryLabel } from '../data/eventCategories';
import type { Child, Event } from '../models';

interface EventDetailsDialogProps {
  event: Event | null;
  child: Child | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function EventDetailsDialog({ event, child, onClose, onEdit, onDelete }: EventDetailsDialogProps) {
  if (event === null) {
    return null;
  }

  const timeLabel = event.endTime === null ? event.startTime : `${event.startTime}-${event.endTime}`;

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="event-details-dialog" role="dialog" aria-modal="true" aria-labelledby="event-details-title">
        <header className="event-details-dialog__header">
          <h2 id="event-details-title">{event.title}</h2>
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
          <div>
            <dt>תאריך</dt>
            <dd>{event.date}</dd>
          </div>
          <div>
            <dt>שעה</dt>
            <dd>
              <span className="event-details-list__time">{timeLabel}</span>
              {event.endsNextDay ? <span className="event-details-list__next-day">למחרת</span> : null}
            </dd>
          </div>
          {event.location !== null ? (
            <div>
              <dt>מיקום</dt>
              <dd>{event.location}</dd>
            </div>
          ) : null}
          {event.notes !== null ? (
            <div>
              <dt>הערות</dt>
              <dd>{event.notes}</dd>
            </div>
          ) : null}
        </dl>

        <div className="event-details-dialog__actions">
          <button className="event-details-dialog__edit" type="button" onClick={onEdit}>
            עריכת אירוע
          </button>
          <button className="event-details-dialog__delete" type="button" onClick={onDelete}>
            מחיקת אירוע
          </button>
        </div>
      </section>
    </div>
  );
}
