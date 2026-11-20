/** 0: не знаю, 1: почти, 2: знаю */
export type Grade = 0 | 1 | 2;

export type Card = {
  ef: number; // коэффициент легкости SM-2
  interval: number; // дни до следующего повторения
  due: number; // время следующего повторения, мс
  reps: number; // успешных повторений подряд
  lapses: number; // сколько раз забыт
  last: Grade;
  seen: number; // время последней оценки, мс
  count: number; // всего оценок
};

export type Status = 'new' | 'bad' | 'mid' | 'good';

const DAY = 24 * 60 * 60 * 1000;
const MIN = 60 * 1000;

/** Упрощенный SM-2: «не знаю» возвращает вопрос через 10 минут, «почти» через день, «знаю» растит интервал. */
export function schedule(card: Card | undefined, grade: Grade, now: number): Card {
  const c: Card = card
    ? { ...card }
    : { ef: 2.5, interval: 0, due: now, reps: 0, lapses: 0, last: grade, seen: now, count: 0 };
  c.count += 1;
  c.seen = now;
  c.last = grade;
  if (grade === 0) {
    c.ef = Math.max(1.3, c.ef - 0.2);
    c.reps = 0;
    c.lapses += 1;
    c.interval = 0;
    c.due = now + 10 * MIN;
  } else if (grade === 1) {
    c.ef = Math.max(1.3, c.ef - 0.1);
    c.interval = Math.max(1, Math.round(c.interval * 1.2));
    c.due = now + c.interval * DAY;
  } else {
    c.ef = Math.min(2.8, c.ef + 0.1);
    c.reps += 1;
    c.interval = c.reps === 1 ? 1 : c.reps === 2 ? 3 : Math.round(Math.max(c.interval, 1) * c.ef);
    c.due = now + c.interval * DAY;
  }
  return c;
}

export function statusOf(card: Card | undefined): Status {
  if (!card) return 'new';
  return card.last === 2 ? 'good' : card.last === 1 ? 'mid' : 'bad';
}

export const STATUS_LABEL: Record<Status, string> = {
  new: 'Не начат',
  bad: 'Не знаю',
  mid: 'Почти',
  good: 'Знаю',
};

export const GRADE_LABEL: Record<Grade, string> = { 0: 'Не знаю', 1: 'Почти', 2: 'Знаю' };

/** Оценка по доле правильного: от 85% «знаю», от 50% «почти». */
export function gradeFromScore(score: number): Grade {
  return score >= 0.85 ? 2 : score >= 0.5 ? 1 : 0;
}
