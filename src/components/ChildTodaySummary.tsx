import type { CSSProperties } from 'react';
import type { ChildTodaySummaryData } from '../services/familyActionCenter';
import { formatActionCenterTime } from '../services/familyActionCenter';

interface ChildTodaySummaryProps {
  summary: ChildTodaySummaryData;
}

export function ChildTodaySummary({ summary }: ChildTodaySummaryProps) {
  const style = { '--child-color': summary.child.color } as CSSProperties;

  return (
    <article className="child-today-card" style={style}>
      <div className="child-today-card__header">
        <span className="child-today-card__avatar" aria-hidden="true">
          {summary.child.name.trim().charAt(0)}
        </span>
        <h3>{summary.child.name}</h3>
      </div>
      {summary.nextOccurrence !== null ? (
        <p>
          הבא: {formatActionCenterTime(summary.nextOccurrence)} {summary.nextOccurrence.title}
        </p>
      ) : summary.hasNonSchoolOccurrencesToday ? (
        <p>אין עוד פעילויות להיום</p>
      ) : (
        <p>אין פעילויות נוספות היום</p>
      )}
      {summary.schoolLessonCount > 0 ? <span>בית ספר היום: {summary.schoolLessonCount} שיעורים</span> : null}
    </article>
  );
}
