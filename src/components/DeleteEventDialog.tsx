import type { Event, ScheduleOccurrence } from '../models';

interface DeleteEventDialogProps {
  event: Event | null;
  pendingOccurrence?: ScheduleOccurrence | null;
  title?: string;
  message?: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteEventDialog({
  event,
  pendingOccurrence = null,
  title = 'למחוק את האירוע?',
  message,
  confirmLabel = 'מחק',
  onCancel,
  onConfirm,
}: DeleteEventDialogProps) {
  if (event === null && pendingOccurrence === null) {
    return null;
  }

  const displayTitle = pendingOccurrence?.title ?? event?.title ?? '';
  const heading = pendingOccurrence !== null ? 'לבטל את המופע הזה?' : title;

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="delete-event-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-event-title">
        <h2 id="delete-event-title">{heading}</h2>
        <p>{displayTitle}</p>
        {pendingOccurrence !== null ? <p>{pendingOccurrence.date}</p> : null}
        {message !== undefined ? <p>{message}</p> : null}
        <div className="delete-event-dialog__actions">
          <button className="delete-event-dialog__confirm" type="button" onClick={onConfirm}>
            {pendingOccurrence !== null ? 'בטל מופע' : confirmLabel}
          </button>
          <button className="delete-event-dialog__cancel" type="button" onClick={onCancel}>
            ביטול
          </button>
        </div>
      </section>
    </div>
  );
}
