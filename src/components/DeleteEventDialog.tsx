import type { Event } from '../models';

interface DeleteEventDialogProps {
  event: Event | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteEventDialog({ event, onCancel, onConfirm }: DeleteEventDialogProps) {
  if (event === null) {
    return null;
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="delete-event-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-event-title">
        <h2 id="delete-event-title">למחוק את האירוע?</h2>
        <p>{event.title}</p>
        <div className="delete-event-dialog__actions">
          <button className="delete-event-dialog__confirm" type="button" onClick={onConfirm}>
            מחק
          </button>
          <button className="delete-event-dialog__cancel" type="button" onClick={onCancel}>
            ביטול
          </button>
        </div>
      </section>
    </div>
  );
}
