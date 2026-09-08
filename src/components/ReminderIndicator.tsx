import { useUiPreferences } from '../i18n';
import type { EventReminder } from '../models';
import { getReminderAccessibleLabel } from '../services/eventReminders';

interface ReminderIndicatorProps {
  reminder: EventReminder | null;
}

export function ReminderIndicator({ reminder }: ReminderIndicatorProps) {
  const { language } = useUiPreferences();

  if (reminder === null || !reminder.enabled) {
    return null;
  }

  const label = getReminderAccessibleLabel(reminder, language);

  return (
    <span className="reminder-indicator" title={label} aria-label={label}>
      🔔
    </span>
  );
}
