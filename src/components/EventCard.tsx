import type { CSSProperties } from 'react';
import type { Child, ScheduleOccurrence } from '../models';
import { getEventCategoryLabel } from '../data/eventCategories';

interface EventCardProps {
  occurrence: ScheduleOccurrence;
  child: Child;
  isEditable?: boolean;
  isRecurring?: boolean;
  onSelect?: (occurrence: ScheduleOccurrence) => void;
}

export function EventCard({ occurrence, child, isEditable = false, isRecurring = false, onSelect }: EventCardProps) {
  const style = { '--child-color': child.color } as CSSProperties;
  const timeLabel = occurrence.endTime === null ? occurrence.startTime : `${occurrence.startTime}-${occurrence.endTime}`;
  const content = (
    <>
      <div className="event-card__topline">
        <span className="event-card__time">{timeLabel}</span>
        {occurrence.endsNextDay ? <span className="event-card__next-day">למחרת</span> : null}
        {isRecurring ? <span className="event-card__recurring">חוזר</span> : null}
        <span className="event-card__badge">{getEventCategoryLabel(occurrence)}</span>
      </div>
      <div className="event-card__child">{child.name}</div>
      <h3 className="event-card__title">{occurrence.title}</h3>
      {occurrence.location !== null ? <p className="event-card__location">{occurrence.location}</p> : null}
      {isEditable ? <span className="event-card__edit-cue">פרטים / עריכה</span> : null}
    </>
  );

  if (isEditable) {
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
