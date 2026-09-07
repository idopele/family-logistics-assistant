import type { Language } from '../i18n';
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

export const localizedEventCategories: Record<Language, Record<EventCategory, string>> = {
  he: eventCategories,
  en: {
    school: 'School',
    basketball: 'Basketball',
    dance: 'Dance',
    privateLesson: 'Private lesson',
    scouts: 'Scouts',
    doctor: 'Doctor',
    dentist: 'Dentist',
    haircut: 'Haircut',
    friends: 'Friends',
    family: 'Family',
    work: 'Work',
    romanticDate: 'Date',
    meal: 'Meal',
    birthday: 'Birthday',
    exam: 'Exam',
    transportation: 'Transportation',
    parentMeeting: 'Parent meeting',
    performance: 'Performance',
    openPractice: 'Open practice',
    other: 'Other',
  },
};

export function getEventCategoryLabel(
  event: { category: EventCategory; customCategoryLabel: string | null },
  language: Language = 'he',
): string {
  if (event.category === 'other' && event.customCategoryLabel !== null && event.customCategoryLabel.trim() !== '') {
    return event.customCategoryLabel;
  }

  return localizedEventCategories[language][event.category];
}
