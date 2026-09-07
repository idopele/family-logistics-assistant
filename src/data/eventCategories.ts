import type { EventCategory } from '../models';

export const eventCategories: Record<EventCategory, string> = {
  school: 'בית ספר',
  basketball: 'כדורסל',
  dance: 'ריקוד',
  privateLesson: 'שיעור פרטי',
  scouts: 'צופים',
  doctor: 'רופא',
  dentist: 'רופא שיניים',
  haircut: 'תספורת',
  friends: 'פגישה עם חברים',
  family: 'משפחה',
  work: 'עבודה',
  romanticDate: 'DATE',
  meal: 'ארוחה',
  birthday: 'יום הולדת',
  exam: 'מבחן',
  transportation: 'הסעה',
  parentMeeting: 'יום הורים',
  performance: 'מופע',
  openPractice: 'אימון פתוח',
  other: 'אחר',
};

export function getEventCategoryLabel(event: { category: EventCategory; customCategoryLabel: string | null }): string {
  if (event.category === 'other' && event.customCategoryLabel !== null && event.customCategoryLabel.trim() !== '') {
    return event.customCategoryLabel;
  }

  return eventCategories[event.category];
}
