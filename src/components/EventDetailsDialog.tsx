import { getEventCategoryLabel } from '../data/eventCategories';
import type { Child, Event, ScheduleOccurrence } from '../models';

interface EventDetailsDialogProps {
  event: Event | null;
  occurrence: ScheduleOccurrence | null;
  child: Child | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onEditOccurrence: () => void;
  onCancelOccurrence: () => void;
  onEditSeries: () => void;
  onDeleteSeries: () => void;
}

export function EventDetailsDialog({
  event,
  occurrence,
  child,
  onClose,
  onEdit,
  onDelete,
  onEditOccurrence,
  onCancelOccurrence,
  onEditSeries,
  onDeleteSeries,
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

        <div className="event-details-dialog__actions">
          {isRecurring ? (
            <>
              <button className="event-details-dialog__edit" type="button" onClick={onEditOccurrence}>
                עריכת המופע הזה
              </button>
              <button className="event-details-dialog__edit" type="button" onClick={onEditSeries}>
                עריכת כל הסדרה
              </button>
              <button className="event-details-dialog__delete" type="button" onClick={onCancelOccurrence}>
                ביטול המופע הזה
              </button>
              <button className="event-details-dialog__delete" type="button" onClick={onDeleteSeries}>
                מחיקת כל הסדרה
              </button>
            </>
          ) : (
            <>
              <button className="event-details-dialog__edit" type="button" onClick={onEdit}>
                עריכת אירוע
              </button>
              <button className="event-details-dialog__delete" type="button" onClick={onDelete}>
                מחיקת אירוע
              </button>
            </>
          )}
          <button className="event-details-dialog__close" type="button" onClick={onClose}>
            סגירה
          </button>
        </div>
      </section>
    </div>
  );
}
