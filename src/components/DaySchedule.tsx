import type { CSSProperties, ReactNode } from 'react';
import type { Child, ScheduleOccurrence } from '../models';
import type { ChildFilter } from './ScheduleFilters';
import { formatDisplayDate } from '../utils/week';
import { EventCard } from './EventCard';

interface DayScheduleProps {
  label: string;
  date: string;
  occurrences: ScheduleOccurrence[];
  childrenById: Map<string, Child>;
  childFilter: ChildFilter;
  editableEventIds: Set<string>;
  customRecurringEventIds: Set<string>;
  onCustomEventSelect: (occurrence: ScheduleOccurrence) => void;
  isToday: boolean;
}

export function DaySchedule({
  label,
  date,
  occurrences,
  childrenById,
  childFilter,
  editableEventIds,
  customRecurringEventIds,
  onCustomEventSelect,
  isToday,
}: DayScheduleProps) {
  const schoolOccurrences = occurrences.filter((occurrence) => occurrence.category === 'school');
  const afternoonOccurrences = occurrences.filter((occurrence) => occurrence.category !== 'school');

  return (
    <section className="day-schedule" data-today={isToday ? 'true' : 'false'}>
      <header className="day-schedule__header">
        <h2>{label}</h2>
        <time dateTime={date}>{formatDisplayDate(date)}</time>
      </header>
      <div className="day-schedule__events">
        {occurrences.length === 0 ? (
          <p className="day-schedule__empty">אין אירועים</p>
        ) : (
          <>
            {schoolOccurrences.length > 0 ? (
              <ScheduleSection title="בית ספר" variant="school">
                <div className="school-list">
                  {schoolOccurrences.map((occurrence) => {
                    const child = childrenById.get(occurrence.childId);

                    return child ? (
                      <SchoolLessonRow
                        key={`${occurrence.eventId}-${occurrence.date}`}
                        occurrence={occurrence}
                        child={child}
                        showChildLabel={childFilter === 'all'}
                      />
                    ) : null;
                  })}
                </div>
              </ScheduleSection>
            ) : null}

            {afternoonOccurrences.length > 0 ? (
              <ScheduleSection title="אחה״צ וערב" variant="afternoon">
                {afternoonOccurrences.map((occurrence) => {
                  const child = childrenById.get(occurrence.childId);

                  return child ? (
                    <EventCard
                      key={`${occurrence.eventId}-${occurrence.date}`}
                      occurrence={occurrence}
                      child={child}
                      isEditable={editableEventIds.has(occurrence.eventId)}
                      isRecurring={customRecurringEventIds.has(occurrence.eventId)}
                      onSelect={onCustomEventSelect}
                    />
                  ) : null;
                })}
              </ScheduleSection>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

function ScheduleSection({
  title,
  variant,
  children,
}: {
  title: string;
  variant: 'school' | 'afternoon';
  children: ReactNode;
}) {
  return (
    <section className="schedule-section" data-variant={variant}>
      <h3 className="schedule-section__title">{title}</h3>
      <div className="schedule-section__content">{children}</div>
    </section>
  );
}

function SchoolLessonRow({
  occurrence,
  child,
  showChildLabel,
}: {
  occurrence: ScheduleOccurrence;
  child: Child;
  showChildLabel: boolean;
}) {
  const style = { '--child-color': child.color } as CSSProperties;

  return (
    <div className="school-row" data-show-child={showChildLabel ? 'true' : 'false'} style={style}>
      <span className="school-row__indicator" aria-hidden="true" />
      <time className="school-row__time" dateTime={`${occurrence.date}T${occurrence.startTime}`}>
        {occurrence.startTime}
      </time>
      {showChildLabel ? <span className="school-row__child">{child.name}</span> : null}
      <span className="school-row__title">{occurrence.title}</span>
    </div>
  );
}
