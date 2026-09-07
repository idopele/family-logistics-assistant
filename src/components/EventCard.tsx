import type { CSSProperties } from 'react';
import type { Child, ScheduleOccurrence } from '../models';
import { eventCategories } from '../data/eventCategories';

interface EventCardProps {
  occurrence: ScheduleOccurrence;
  child: Child;
}

export function EventCard({ occurrence, child }: EventCardProps) {
  const style = { '--child-color': child.color } as CSSProperties;
  const timeLabel = occurrence.endTime === null ? occurrence.startTime : `${occurrence.startTime}-${occurrence.endTime}`;

  return (
    <article className="event-card" style={style}>
      <div className="event-card__topline">
        <span className="event-card__time">{timeLabel}</span>
        <span className="event-card__badge">{eventCategories[occurrence.category]}</span>
      </div>
      <div className="event-card__child">{child.name}</div>
      <h3 className="event-card__title">{occurrence.title}</h3>
      {occurrence.location !== null ? <p className="event-card__location">{occurrence.location}</p> : null}
    </article>
  );
}
