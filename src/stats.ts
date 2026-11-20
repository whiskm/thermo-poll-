import { QUESTIONS } from './content';
import { statusOf } from './srs';
import { dayKey, type State } from './store';

const DAY = 86400000;

/** Дней подряд с занятиями. Сегодняшний день без занятий серию не обрывает. */
export function streak(activity: State['activity'], now = Date.now()): number {
  let n = 0;
  let t = now;
  if (!activity[dayKey(t)]?.n) t -= DAY;
  while (activity[dayKey(t)]?.n) {
    n++;
    t -= DAY;
  }
  return n;
}

export function learned(s: State): number {
  return QUESTIONS.filter((q) => statusOf(s.cards[q.id]) === 'good').length;
}

/** Дней до зачета (включая сегодня) или null, если дата не задана или прошла. */
export function daysLeft(examDate: string, now = Date.now()): number | null {
  if (!examDate) return null;
  const [y, m, d] = examDate.split('-').map(Number);
  const exam = new Date(y, m - 1, d).getTime();
  const today = new Date(new Date(now).toDateString()).getTime();
  const diff = Math.round((exam - today) / DAY);
  return diff >= 0 ? diff : null;
}

/** Норма на день: невыученные вопросы делятся на оставшиеся дни, минимум дневная цель. */
export function dailyNorm(s: State, now = Date.now()): number {
  const left = daysLeft(s.settings.examDate, now);
  const remaining = QUESTIONS.length - learned(s);
  if (left === null) return s.settings.dailyGoal;
  const perDay = Math.ceil(remaining / Math.max(1, left));
  return Math.max(s.settings.dailyGoal, perDay);
}

export function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h ? `${h} ч ${m} мин` : `${m} мин`;
}
