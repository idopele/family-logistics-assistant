import { getLocalizedText, type SystemCalendarEvent } from '../models';
import { useUiPreferences } from '../i18n';

interface SystemEventDetailsDialogProps {
  event: SystemCalendarEvent | null;
  onClose: () => void;
}

export function SystemEventDetailsDialog({ event, onClose }: SystemEventDetailsDialogProps) {
  const { language, t } = useUiPreferences();

  if (event === null) {
    return null;
  }

  const dateLabel = event.startDate === event.endDate ? event.startDate : `${event.startDate} - ${event.endDate}`;

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="event-details-dialog system-event-details-dialog" role="dialog" aria-modal="true" aria-labelledby="system-event-details-title">
        <header className="event-details-dialog__header">
          <h2 id="system-event-details-title">{getLocalizedText(event.title, language)}</h2>
          <button className="dialog-close-button" type="button" onClick={onClose}>
            {t('close')}
          </button>
        </header>
        <dl className="event-details-list">
          <div>
            <dt>{t('source')}</dt>
            <dd>{getLocalizedText(event.metadata.sourceName, language)}</dd>
          </div>
          <div>
            <dt>{t('date')}</dt>
            <dd>{dateLabel}</dd>
          </div>
          <div>
            <dt>{t('eventType')}</dt>
            <dd>{event.type === 'holiday' ? t('holidaysAndObservances') : t('schoolVacations')}</dd>
          </div>
          {event.description !== null ? (
            <div>
              <dt>{t('details')}</dt>
              <dd>{getLocalizedText(event.description, language)}</dd>
            </div>
          ) : null}
          {event.sourceReference !== null ? (
            <div>
              <dt>{t('sourceReference')}</dt>
              <dd>{event.sourceReference}</dd>
            </div>
          ) : null}
          <div>
            <dt>{t('readOnly')}</dt>
            <dd>{t('systemEventReadOnly')}</dd>
          </div>
        </dl>
        <div className="event-details-dialog__actions">
          <button className="event-details-dialog__close" type="button" onClick={onClose}>
            {t('close')}
          </button>
        </div>
      </section>
    </div>
  );
}
