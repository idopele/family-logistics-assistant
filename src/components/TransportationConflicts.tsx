import { useUiPreferences } from '../i18n';
import type { TransportationConflict, TransportationConflictItem } from '../models';

interface TransportationConflictsProps {
  conflicts: TransportationConflict[];
  summaryLabel?: string;
}

export function TransportationConflicts({ conflicts, summaryLabel }: TransportationConflictsProps) {
  const { t } = useUiPreferences();

  if (conflicts.length === 0) {
    return null;
  }

  return (
    <details className="transportation-conflicts">
      <summary>{summaryLabel ?? `⚠ ${conflicts.length} ${t('transportationConflicts')}`}</summary>
      <div className="transportation-conflicts__list">
        {conflicts.map((conflict) => (
          <article className="transportation-conflict" key={conflict.id}>
            <h3>{t('possibleConflict')}</h3>
            <p className="transportation-conflict__driver">{conflict.first.driverName}</p>
            <ConflictItem item={conflict.first} />
            <ConflictItem item={conflict.second} />
            <p className="transportation-conflict__gap">{t('gap')} {conflict.minutesApart} {t('minutes')}</p>
            <p className="transportation-conflict__message">
              {conflict.severity === 'sameTime'
                ? `${conflict.first.driverName} ${t('exactConflictSuffix')}`
                : t('warningConflictMessage')}
            </p>
          </article>
        ))}
      </div>
    </details>
  );
}

function ConflictItem({ item }: { item: TransportationConflictItem }) {
  const { t } = useUiPreferences();

  return (
    <div className="transportation-conflict__item">
      <time dateTime={`${item.effectiveDate}T${item.time}`}>{item.time}</time>
      <span>
        {formatChildNames(item.childNames, t('additionalPassengers'))} · {item.eventTitle} · {formatDirection(item.direction, t('outbound'), t('returnTrip'))}
      </span>
    </div>
  );
}

function formatChildNames(childNames: string[], emptyLabel: string): string {
  return childNames.length === 0 ? emptyLabel : childNames.join(', ');
}

function formatDirection(direction: TransportationConflictItem['direction'], outbound: string, returnTrip: string): string {
  return direction === 'outbound' ? outbound : returnTrip;
}
