import type { CSSProperties } from 'react';
import { useUiPreferences, type Language, type TranslationKey } from '../i18n';
import type { EventReminder } from '../models';
import type { ChildTodaySummaryData } from '../services/familyActionCenter';
import { formatActionCenterTime } from '../services/familyActionCenter';
import { ReminderIndicator } from './ReminderIndicator';

interface ChildTodaySummaryProps {
  summary: ChildTodaySummaryData;
  reminder: EventReminder | null;
}

export function ChildTodaySummary({ summary, reminder }: ChildTodaySummaryProps) {
  const { language, t } = useUiPreferences();
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
          {t('nextActivity')} <time>{formatActionCenterTime(summary.nextOccurrence)}</time> {summary.nextOccurrence.title}{' '}<ReminderIndicator reminder={reminder} />
        </p>
      ) : summary.hasNonSchoolOccurrencesToday ? (
        <p>{t('noMoreToday')}</p>
      ) : (
        <p>{t('noExtraToday')}</p>
      )}
      {summary.schoolLessonCount > 0 ? (
        <span>
          {t('schoolToday')} {formatLessonCount(summary.schoolLessonCount, language, t)} · {t('lastLesson')}:{' '}
          {summary.lastSchoolLessonStartTime}
        </span>
      ) : null}
    </article>
  );
}

function formatLessonCount(count: number, language: Language, t: (key: TranslationKey) => string): string {
  if (language === 'he') {
    return count === 1 ? `${t('lesson')} ${count}` : `${count} ${t('lessons')}`;
  }

  return count === 1 ? `${count} ${t('lesson')}` : `${count} ${t('lessons')}`;
}
