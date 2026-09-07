import type { CSSProperties } from 'react';
import { useUiPreferences } from '../i18n';
import type { ChildTodaySummaryData } from '../services/familyActionCenter';
import { formatActionCenterTime } from '../services/familyActionCenter';

interface ChildTodaySummaryProps {
  summary: ChildTodaySummaryData;
}

export function ChildTodaySummary({ summary }: ChildTodaySummaryProps) {
  const { t } = useUiPreferences();
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
          {t('nextActivity')} <time>{formatActionCenterTime(summary.nextOccurrence)}</time> {summary.nextOccurrence.title}
        </p>
      ) : summary.hasNonSchoolOccurrencesToday ? (
        <p>{t('noMoreToday')}</p>
      ) : (
        <p>{t('noExtraToday')}</p>
      )}
      {summary.schoolLessonCount > 0 ? <span>{t('schoolToday')} {summary.schoolLessonCount} {t('lessons')}</span> : null}
    </article>
  );
}
