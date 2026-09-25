import { getLocalizedText, type Child, type EventReminder, type ScheduleOccurrence, type TransportationPlan } from '../models';
import type { Language } from '../i18n';
import { useUiPreferences } from '../i18n';
import type { FamilyActionCenterData, TodayTransportationLeg } from '../services/familyActionCenter';
import { formatActionCenterCategoryForLanguage, formatActionCenterTime } from '../services/familyActionCenter';
import { ChildTodaySummary } from './ChildTodaySummary';
import { ReminderIndicator } from './ReminderIndicator';
import { TransportationConflicts } from './TransportationConflicts';

interface FamilyActionCenterProps {
  data: FamilyActionCenterData;
  childrenById: Map<string, Child>;
  transportationPlansByOccurrence: Map<string, TransportationPlan>;
  remindersByOccurrence: Map<string, EventReminder>;
  language: Language;
  isViewingCurrentWeek: boolean;
  onShowCurrentWeek: () => void;
  onOccurrenceSelect: (occurrence: ScheduleOccurrence) => void;
}

export function FamilyActionCenter({
  data,
  childrenById,
  transportationPlansByOccurrence,
  remindersByOccurrence,
  language,
  isViewingCurrentWeek,
  onShowCurrentWeek,
  onOccurrenceSelect,
}: FamilyActionCenterProps) {
  const { t } = useUiPreferences();
  const hasMeaningfulItems =
    data.remainingNonSchoolOccurrences.length > 0 ||
    data.cancellations.length > 0 ||
    data.transportationLegs.length > 0 ||
    data.transportationConflicts.length > 0 ||
    data.changedOccurrences.length > 0 ||
    data.systemEventsToday.length > 0;

  return (
    <section className="family-action-center" aria-labelledby="family-action-center-title">
      <header className="family-action-center__header">
        <div>
          <h2 id="family-action-center-title">{t('actionCenterTitle')}</h2>
          <p>{data.todayLabel}</p>
        </div>
        {!isViewingCurrentWeek ? (
          <button className="family-action-center__week-button" type="button" onClick={onShowCurrentWeek}>
            {t('showCurrentWeek')}
          </button>
        ) : null}
      </header>

      <div className="family-action-center__counts">
        {data.counts.activities > 0 ? <span>{data.counts.activities} {t('activities')}</span> : null}
        {data.counts.transportationLegs > 0 ? <span>{data.counts.transportationLegs} {t('rides')}</span> : null}
        {data.counts.changes > 0 ? <span data-tone="change">{data.counts.changes} {t('change')}</span> : null}
        {data.systemEventsToday.length > 0 ? <span>{data.systemEventsToday.length} {t('calendarContextSection')}</span> : null}
      </div>

      {data.transportationConflicts.length > 0 ? (
        <TransportationConflicts
          conflicts={data.transportationConflicts}
          summaryLabel={`⚠ ${data.transportationConflicts.length} ${t('todayTransportationConflict')}`}
        />
      ) : null}

      <div className="family-action-center__children">
        {data.childSummaries.map((summary) => (
          <ChildTodaySummary
            key={summary.child.id}
            summary={summary}
            reminder={summary.nextOccurrence === null ? null : remindersByOccurrence.get(getOccurrenceKey(summary.nextOccurrence)) ?? null}
          />
        ))}
      </div>

      {data.systemEventsToday.length > 0 ? (
        <section className="family-action-section">
          <h3>{t('calendarContextSection')}</h3>
          <div className="family-action-list">
            {data.systemEventsToday.map((event) => (
              <div className="family-action-row family-action-row--static family-action-row--system" key={event.id}>
                <time>{event.type === 'holiday' ? '🇮🇱' : '🏫'}</time>
                <span>{getLocalizedText(event.title, language)}</span>
                <small>{event.type === 'holiday' ? t('holidaysAndObservances') : t('schoolVacations')}</small>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {data.remainingNonSchoolOccurrences.length > 0 ? (
        <section className="family-action-section">
          <h3>{t('continueToday')}</h3>
          <div className="family-action-list">
            {data.remainingNonSchoolOccurrences.map((occurrence) => (
              <button
                className="family-action-row"
                type="button"
                key={`${occurrence.eventId}-${occurrence.date}`}
                onClick={() => onOccurrenceSelect(occurrence)}
              >
                <time>{formatActionCenterTime(occurrence)}</time>
                <em>{childrenById.get(occurrence.childId)?.name ?? occurrence.childId}</em>
                <span>
                  {occurrence.title}{' '}
                  <ReminderIndicator reminder={remindersByOccurrence.get(getOccurrenceKey(occurrence)) ?? null} />
                </span>
                <small>{formatActionCenterCategoryForLanguage(occurrence, language)}</small>
                {occurrence.location !== null ? <small>{occurrence.location}</small> : null}
                {occurrence.isException ? <b>{t('change')}</b> : null}
                <OccurrenceTransportationSummary plan={transportationPlansByOccurrence.get(getOccurrenceKey(occurrence)) ?? null} />
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {data.cancellations.length > 0 ? (
        <section className="family-action-section">
          <h3>{t('changesAndCancellations')}</h3>
          <div className="family-action-list">
            {data.cancellations.map((cancellation) => (
              <div className="family-action-row family-action-row--static" key={cancellation.id}>
                <time>{cancellation.time}</time>
                <span>{t('cancelledToday')}</span>
                <small>
                  {cancellation.childName} · {cancellation.title}
                </small>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {data.transportationLegs.length > 0 ? (
        <section className="family-action-section">
          <h3>{t('ridesToday')}</h3>
          <div className="family-action-list">
            {data.transportationLegs.map((leg) => (
              <TransportationLegRow key={leg.id} leg={leg} />
            ))}
          </div>
        </section>
      ) : null}

      {!hasMeaningfulItems ? <p className="family-action-center__empty">{t('noActionItems')}</p> : null}
    </section>
  );
}

function OccurrenceTransportationSummary({ plan }: { plan: TransportationPlan | null }) {
  const { t } = useUiPreferences();

  if (plan === null) {
    return null;
  }

  return (
    <small>
      {plan.outbound !== null ? `${t('outbound')}: ${plan.outbound.driverName} ${plan.outbound.time}` : ''}
      {plan.outbound !== null && plan.returnTrip !== null ? ' · ' : ''}
      {plan.returnTrip !== null ? `${t('returnTrip')}: ${plan.returnTrip.driverName} ${plan.returnTrip.time}` : ''}
    </small>
  );
}

function getOccurrenceKey(occurrence: ScheduleOccurrence): string {
  return `${occurrence.eventId}|${occurrence.date}`;
}

function TransportationLegRow({ leg }: { leg: TodayTransportationLeg }) {
  const { t } = useUiPreferences();

  return (
    <div className="family-action-row family-action-row--static family-action-row--transport">
      <time>{leg.time}</time>
      <span>
        {leg.driverName} · {leg.direction === 'outbound' ? t('outbound') : t('returnTrip')}
      </span>
      <small>
        {formatPassengerNames(leg.passengerNames, t('additionalPassengers'))} · {leg.eventTitle}
      </small>
    </div>
  );
}

function formatPassengerNames(passengerNames: string[], emptyLabel: string): string {
  return passengerNames.length === 0 ? emptyLabel : passengerNames.join(', ');
}
