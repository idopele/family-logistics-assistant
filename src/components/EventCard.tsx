import type { CSSProperties } from 'react';
import { getEventCategoryLabel } from '../data/eventCategories';
import type { Language } from '../i18n';
import { useUiPreferences } from '../i18n';
import type { Child, ScheduleOccurrence, TransportationPlan } from '../models';
import type { EventReminder } from '../models';
import { ReminderIndicator } from './ReminderIndicator';

interface EventCardProps {
  occurrence: ScheduleOccurrence;
  child: Child;
  isEditable?: boolean;
  isRecurring?: boolean;
  transportationPlan?: TransportationPlan | null;
  reminder?: EventReminder | null;
  language: Language;
  onSelect?: (occurrence: ScheduleOccurrence) => void;
}

export function EventCard({
  occurrence,
  child,
  isEditable = false,
  isRecurring = false,
  transportationPlan = null,
  reminder = null,
  language,
  onSelect,
}: EventCardProps) {
  const { t } = useUiPreferences();
  const style = { '--child-color': child.color } as CSSProperties;
  const timeLabel = occurrence.endTime === null ? occurrence.startTime : `${occurrence.startTime}-${occurrence.endTime}`;
  const content = (
    <>
      <div className="event-card__topline">
        <span className="event-card__time">{timeLabel}</span>
        {occurrence.endsNextDay ? <span className="event-card__next-day">{t('nextDay')}</span> : null}
        <ReminderIndicator reminder={reminder} />
        {isRecurring ? <span className="event-card__recurring">{t('recurringBadge')}</span> : null}
        <span className="event-card__badge">{getEventCategoryLabel(occurrence, language)}</span>
      </div>
      <div className="event-card__child">{child.name}</div>
      <h3 className="event-card__title">{occurrence.title}</h3>
      {occurrence.location !== null ? <p className="event-card__location">{occurrence.location}</p> : null}
      {transportationPlan !== null ? <TransportationPlanSummary plan={transportationPlan} /> : null}
      {onSelect !== undefined ? <span className="event-card__edit-cue">{isEditable ? t('detailsEdit') : t('details')}</span> : null}
    </>
  );

  if (onSelect !== undefined) {
    return (
      <button className="event-card event-card--button" type="button" style={style} onClick={() => onSelect?.(occurrence)}>
        {content}
      </button>
    );
  }

  return (
    <article className="event-card" style={style}>
      {content}
    </article>
  );
}

function TransportationPlanSummary({ plan }: { plan: TransportationPlan }) {
  const { t } = useUiPreferences();

  return (
    <div className="event-card__transportation">
      {plan.outbound !== null ? (
        <span>
          🚗 {t('outbound')}: {plan.outbound.driverName} · {plan.outbound.time}
          {plan.outbound.occursNextDay ? ` · ${t('nextDay')}` : ''}
        </span>
      ) : null}
      {plan.returnTrip !== null ? (
        <span>
          🚗 {t('returnTrip')}: {plan.returnTrip.driverName} · {plan.returnTrip.time}
          {plan.returnTrip.occursNextDay ? ` · ${t('nextDay')}` : ''}
        </span>
      ) : null}
    </div>
  );
}
