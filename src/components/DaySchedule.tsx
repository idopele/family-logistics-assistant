import type { CSSProperties, ReactNode } from 'react';
import type { Language } from '../i18n';
import { useUiPreferences } from '../i18n';
import type { Child, EventReminder, ScheduleOccurrence, TransportationPlan } from '../models';
import type { ChildFilter } from './ScheduleFilters';
import { formatDisplayDate } from '../utils/week';
import { EventCard } from './EventCard';
import { ReminderIndicator } from './ReminderIndicator';

interface DayScheduleProps {
  label: string;
  date: string;
  occurrences: ScheduleOccurrence[];
  childrenById: Map<string, Child>;
  childFilter: ChildFilter;
  editableEventIds: Set<string>;
  customRecurringEventIds: Set<string>;
  transportationPlansByOccurrence: Map<string, TransportationPlan>;
  remindersByOccurrence?: Map<string, EventReminder>;
  language?: Language;
  onOccurrenceSelect: (occurrence: ScheduleOccurrence) => void;
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
  transportationPlansByOccurrence,
  remindersByOccurrence = new Map(),
  language = 'he',
  onOccurrenceSelect,
  isToday,
}: DayScheduleProps) {
  const { t } = useUiPreferences();
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
          <p className="day-schedule__empty">{t('noEvents')}</p>
        ) : (
          <>
            {schoolOccurrences.length > 0 ? (
              <ScheduleSection title={t('schoolSection')} variant="school">
                <div className="school-list">
                  {schoolOccurrences.map((occurrence) => {
                    const child = childrenById.get(occurrence.childId);

                    return child ? (
                      <SchoolLessonRow
                        key={`${occurrence.eventId}-${occurrence.date}`}
                        occurrence={occurrence}
                        child={child}
                        showChildLabel={childFilter === 'all'}
                        reminder={remindersByOccurrence.get(getOccurrenceKey(occurrence)) ?? null}
                        onSelect={onOccurrenceSelect}
                      />
                    ) : null;
                  })}
                </div>
              </ScheduleSection>
            ) : null}

            {afternoonOccurrences.length > 0 ? (
              <ScheduleSection title={t('afternoonSection')} variant="afternoon">
                {afternoonOccurrences.map((occurrence) => {
                  const child = childrenById.get(occurrence.childId);

                  return child ? (
                    <EventCard
                      key={`${occurrence.eventId}-${occurrence.date}`}
                      occurrence={occurrence}
                      child={child}
                      isEditable={editableEventIds.has(occurrence.eventId)}
                      isRecurring={customRecurringEventIds.has(occurrence.eventId)}
                      transportationPlan={transportationPlansByOccurrence.get(getOccurrenceKey(occurrence)) ?? null}
                      reminder={remindersByOccurrence.get(getOccurrenceKey(occurrence)) ?? null}
                      language={language}
                      onSelect={onOccurrenceSelect}
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

function getOccurrenceKey(occurrence: ScheduleOccurrence): string {
  return `${occurrence.eventId}|${occurrence.date}`;
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
  onSelect,
  reminder,
}: {
  occurrence: ScheduleOccurrence;
  child: Child;
  showChildLabel: boolean;
  reminder: EventReminder | null;
  onSelect: (occurrence: ScheduleOccurrence) => void;
}) {
  const style = { '--child-color': child.color } as CSSProperties;

  return (
    <button
      className="school-row school-row--button"
      data-show-child={showChildLabel ? 'true' : 'false'}
      style={style}
      type="button"
      onClick={() => onSelect(occurrence)}
    >
      <span className="school-row__indicator" aria-hidden="true" />
      <time className="school-row__time" dateTime={`${occurrence.date}T${occurrence.startTime}`}>
        {occurrence.startTime}
      </time>
      <ReminderIndicator reminder={reminder} />
      {showChildLabel ? <span className="school-row__child">{child.name}</span> : null}
      <span className="school-row__title">{occurrence.title}</span>
    </button>
  );
}
