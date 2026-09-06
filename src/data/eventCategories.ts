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
  friends: 'חברים',
  family: 'משפחה',
  birthday: 'יום הולדת',
  exam: 'מבחן',
  transportation: 'הסעה',
  other: 'אחר',
};
