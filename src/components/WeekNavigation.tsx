interface WeekNavigationProps {
  weekLabel: string;
  onPreviousWeek: () => void;
  onCurrentWeek: () => void;
  onNextWeek: () => void;
}

export function WeekNavigation({ weekLabel, onPreviousWeek, onCurrentWeek, onNextWeek }: WeekNavigationProps) {
  return (
    <section className="week-navigation" aria-label="ניווט שבועי">
      <div className="week-navigation__range" aria-live="polite">
        {weekLabel}
      </div>
      <div className="week-navigation__buttons">
        <button className="week-navigation__button" type="button" onClick={onPreviousWeek}>
          שבוע קודם
        </button>
        <button className="week-navigation__button" type="button" onClick={onCurrentWeek}>
          השבוע
        </button>
        <button className="week-navigation__button" type="button" onClick={onNextWeek}>
          שבוע הבא
        </button>
      </div>
    </section>
  );
}
