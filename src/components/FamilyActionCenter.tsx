import type { Child, ScheduleOccurrence, TransportationPlan } from '../models';
import type { FamilyActionCenterData, TodayTransportationLeg } from '../services/familyActionCenter';
import { formatActionCenterCategory, formatActionCenterTime } from '../services/familyActionCenter';
import { ChildTodaySummary } from './ChildTodaySummary';
import { TransportationConflicts } from './TransportationConflicts';

interface FamilyActionCenterProps {
  data: FamilyActionCenterData;
  childrenById: Map<string, Child>;
  transportationPlansByOccurrence: Map<string, TransportationPlan>;
  isViewingCurrentWeek: boolean;
  onShowCurrentWeek: () => void;
  onOccurrenceSelect: (occurrence: ScheduleOccurrence) => void;
}

export function FamilyActionCenter({
  data,
  childrenById,
  transportationPlansByOccurrence,
  isViewingCurrentWeek,
  onShowCurrentWeek,
  onOccurrenceSelect,
}: FamilyActionCenterProps) {
  const hasMeaningfulItems =
    data.remainingNonSchoolOccurrences.length > 0 ||
    data.cancellations.length > 0 ||
    data.transportationLegs.length > 0 ||
    data.transportationConflicts.length > 0 ||
    data.changedOccurrences.length > 0;

  return (
    <section className="family-action-center" aria-labelledby="family-action-center-title">
      <header className="family-action-center__header">
        <div>
          <h2 id="family-action-center-title">היום במשפחה</h2>
          <p>{data.todayLabel}</p>
        </div>
        {!isViewingCurrentWeek ? (
          <button className="family-action-center__week-button" type="button" onClick={onShowCurrentWeek}>
            הצג את השבוע הנוכחי
          </button>
        ) : null}
      </header>

      <div className="family-action-center__counts">
        {data.counts.activities > 0 ? <span>{data.counts.activities} פעילויות</span> : null}
        {data.counts.transportationLegs > 0 ? <span>{data.counts.transportationLegs} הסעות</span> : null}
        {data.counts.changes > 0 ? <span>שינוי {data.counts.changes}</span> : null}
      </div>

      {data.transportationConflicts.length > 0 ? (
        <TransportationConflicts
          conflicts={data.transportationConflicts}
          summaryLabel={`⚠️ ${data.transportationConflicts.length} התנגשות אפשרית בהסעות היום`}
        />
      ) : null}

      <div className="family-action-center__children">
        {data.childSummaries.map((summary) => (
          <ChildTodaySummary key={summary.child.id} summary={summary} />
        ))}
      </div>

      {data.remainingNonSchoolOccurrences.length > 0 ? (
        <section className="family-action-section">
          <h3>המשך היום</h3>
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
                <span>{occurrence.title}</span>
                <small>{formatActionCenterCategory(occurrence)}</small>
                {occurrence.location !== null ? <small>{occurrence.location}</small> : null}
                {occurrence.isException ? <b>שינוי היום</b> : null}
                <OccurrenceTransportationSummary plan={transportationPlansByOccurrence.get(getOccurrenceKey(occurrence)) ?? null} />
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {data.cancellations.length > 0 ? (
        <section className="family-action-section">
          <h3>שינויים וביטולים</h3>
          <div className="family-action-list">
            {data.cancellations.map((cancellation) => (
              <div className="family-action-row family-action-row--static" key={cancellation.id}>
                <time>{cancellation.time}</time>
                <span>בוטל היום</span>
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
          <h3>הסעות היום</h3>
          <div className="family-action-list">
            {data.transportationLegs.map((leg) => (
              <TransportationLegRow key={leg.id} leg={leg} />
            ))}
          </div>
        </section>
      ) : null}

      {!hasMeaningfulItems ? (
        <p className="family-action-center__empty">אין כרגע משהו שדורש תשומת לב מיוחדת היום</p>
      ) : null}
    </section>
  );
}

function OccurrenceTransportationSummary({ plan }: { plan: TransportationPlan | null }) {
  if (plan === null) {
    return null;
  }

  return (
    <small>
      {plan.outbound !== null ? `הסעה הלוך: ${plan.outbound.driverName} ${plan.outbound.time}` : ''}
      {plan.outbound !== null && plan.returnTrip !== null ? ' · ' : ''}
      {plan.returnTrip !== null ? `הסעה חזור: ${plan.returnTrip.driverName} ${plan.returnTrip.time}` : ''}
    </small>
  );
}

function getOccurrenceKey(occurrence: ScheduleOccurrence): string {
  return `${occurrence.eventId}|${occurrence.date}`;
}

function TransportationLegRow({ leg }: { leg: TodayTransportationLeg }) {
  return (
    <div className="family-action-row family-action-row--static">
      <time>{leg.time}</time>
      <span>
        {leg.driverName} · {leg.direction === 'outbound' ? 'הלוך' : 'חזור'}
      </span>
      <small>
        {formatPassengerNames(leg.passengerNames)} · {leg.eventTitle}
      </small>
    </div>
  );
}

function formatPassengerNames(passengerNames: string[]): string {
  return passengerNames.length === 0 ? 'נוסעים נוספים' : passengerNames.join(', ');
}
