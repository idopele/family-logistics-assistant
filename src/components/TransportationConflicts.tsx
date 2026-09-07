import type { TransportationConflict, TransportationConflictItem } from '../models';

interface TransportationConflictsProps {
  conflicts: TransportationConflict[];
}

export function TransportationConflicts({ conflicts }: TransportationConflictsProps) {
  if (conflicts.length === 0) {
    return null;
  }

  return (
    <details className="transportation-conflicts">
      <summary>⚠️ {conflicts.length} התנגשויות אפשריות בהסעות</summary>
      <div className="transportation-conflicts__list">
        {conflicts.map((conflict) => (
          <article className="transportation-conflict" key={conflict.id}>
            <h3>התנגשות אפשרית</h3>
            <p className="transportation-conflict__driver">{conflict.first.driverName}</p>
            <ConflictItem item={conflict.first} />
            <ConflictItem item={conflict.second} />
            <p className="transportation-conflict__gap">פער: {conflict.minutesApart} דקות</p>
            <p className="transportation-conflict__message">
              {conflict.severity === 'sameTime'
                ? 'שתי הסעות משויכות לאותו נהג באותה שעה.'
                : 'ייתכן שאין מספיק זמן בין שתי ההסעות.'}
            </p>
          </article>
        ))}
      </div>
    </details>
  );
}

function ConflictItem({ item }: { item: TransportationConflictItem }) {
  return (
    <div className="transportation-conflict__item">
      <time dateTime={`${item.effectiveDate}T${item.time}`}>{item.time}</time>
      <span>
        {formatChildNames(item.childNames)} · {item.eventTitle} · {formatDirection(item.direction)}
      </span>
    </div>
  );
}

function formatChildNames(childNames: string[]): string {
  return childNames.length === 0 ? 'נוסעים נוספים' : childNames.join(', ');
}

function formatDirection(direction: TransportationConflictItem['direction']): string {
  return direction === 'outbound' ? 'הלוך' : 'חזור';
}
