import { QUESTIONS, byId, type Question } from './content';
import { statusOf, type Grade } from './srs';
import type { State } from './store';
import { lowerRu, shuffle, splitMath, termsFor } from './text';

export function answerOf(q: Question, s: State): string[] {
  return s.edits[q.id]?.answer ?? q.answer;
}

export type Source = 'due' | 'all' | 'weak' | 'fav' | 'new';
export type SessionOpts = { source: Source; sections: string[]; count: number; ids?: number[] };

export const SOURCE_LABEL: Record<Source, string> = {
  due: 'По расписанию',
  weak: 'Слабые места',
  new: 'Новые',
  fav: 'Избранное',
  all: 'Все подряд',
};

/** Список вопросов для занятия. count = 0 означает «все подходящие». */
export function buildQueue(o: SessionOpts, s: State, now = Date.now(), rnd = Math.random): number[] {
  if (o.ids?.length) return o.ids.slice();
  const pool = QUESTIONS.filter((q) => !o.sections.length || o.sections.includes(q.section));
  let ids: number[];
  switch (o.source) {
    case 'due': {
      const due = pool
        .filter((q) => s.cards[q.id] && s.cards[q.id].due <= now)
        .sort((a, b) => s.cards[a.id].due - s.cards[b.id].due)
        .map((q) => q.id);
      const fresh = pool.filter((q) => !s.cards[q.id]).map((q) => q.id);
      ids = [...due, ...fresh];
      break;
    }
    case 'weak': {
      const rank = (id: number) => {
        const st = statusOf(s.cards[id]);
        return st === 'bad' ? 0 : st === 'mid' ? 1 : 9;
      };
      ids = pool
        .map((q) => q.id)
        .filter((id) => rank(id) < 9)
        .sort((a, b) => rank(a) - rank(b) || (s.cards[a]?.seen ?? 0) - (s.cards[b]?.seen ?? 0));
      break;
    }
    case 'new':
      ids = pool.filter((q) => !s.cards[q.id]).map((q) => q.id);
      break;
    case 'fav':
      ids = shuffle(pool.filter((q) => s.favorites[q.id]).map((q) => q.id), rnd);
      break;
    default:
      ids = shuffle(pool.map((q) => q.id), rnd);
  }
  return o.count > 0 ? ids.slice(0, o.count) : ids;
}

/** Сколько вопросов ждут повторения сейчас (без новых). */
export function dueCount(s: State, now = Date.now()): number {
  return Object.values(s.cards).filter((c) => c.due <= now).length;
}

// ---------- Пропуски ----------
export type Seg =
  | { kind: 'text'; v: string }
  | { kind: 'math'; v: string }
  | { kind: 'blank'; id: number; answer: string; math: boolean };

export type Cloze = { sentences: Seg[][]; blanks: { id: number; answer: string; math: boolean }[]; bank: { v: string; math: boolean }[] };

/** Строит упражнение: ключевые термины (и при желании формулы) превращаются в пропуски. */
export function buildCloze(q: Question, s: State, withMath: boolean, rnd = Math.random): Cloze {
  const answer = answerOf(q, s);
  const terms = termsFor(q.keyTerms, answer).slice(0, 6);
  const used = new Set<string>();
  const blanks: Cloze['blanks'] = [];
  let mathBlanks = 0;
  const mathLimit = withMath ? 3 : 0;
  const sentences = answer.map((sent) => {
    const segs: Seg[] = [];
    for (const p of splitMath(sent)) {
      if (p.kind === 'math') {
        if (mathBlanks < mathLimit && p.v.length > 6 && !used.has('$' + p.v)) {
          used.add('$' + p.v);
          mathBlanks++;
          const id = blanks.length;
          blanks.push({ id, answer: p.v, math: true });
          segs.push({ kind: 'blank', id, answer: p.v, math: true });
        } else segs.push(p);
        continue;
      }
      let rest = p.v;
      // ищем первое вхождение каждого еще не использованного термина
      for (;;) {
        const low = lowerRu(rest);
        let best = -1;
        let bestTerm = '';
        for (const t of terms) {
          if (used.has(t)) continue;
          const i = low.indexOf(lowerRu(t));
          if (i >= 0 && (best < 0 || i < best)) {
            best = i;
            bestTerm = t;
          }
        }
        if (best < 0) break;
        used.add(bestTerm);
        if (best > 0) segs.push({ kind: 'text', v: rest.slice(0, best) });
        const original = rest.slice(best, best + bestTerm.length);
        const id = blanks.length;
        blanks.push({ id, answer: original, math: false });
        segs.push({ kind: 'blank', id, answer: original, math: false });
        rest = rest.slice(best + bestTerm.length);
      }
      if (rest) segs.push({ kind: 'text', v: rest });
    }
    return segs;
  });
  // в банк вариантов добавляются 2 термина и 1 формула из соседних вопросов раздела
  const near = shuffle(QUESTIONS.filter((x) => x.section === q.section && x.id !== q.id), rnd);
  const have = new Set(blanks.map((b) => lowerRu(b.answer)));
  const extraTerms: string[] = [];
  const extraMath: string[] = [];
  for (const x of near) {
    for (const t of x.keyTerms) if (extraTerms.length < 2 && !have.has(lowerRu(t))) { extraTerms.push(t); have.add(lowerRu(t)); }
    for (const f of x.formulas) if (withMath && mathBlanks && extraMath.length < 1 && !have.has(lowerRu(f))) { extraMath.push(f); have.add(lowerRu(f)); }
  }
  const bank = shuffle(
    [
      ...blanks.map((b) => ({ v: b.answer, math: b.math })),
      ...extraTerms.map((v) => ({ v, math: false })),
      ...extraMath.map((v) => ({ v, math: true })),
    ],
    rnd,
  );
  return { sentences, blanks, bank };
}

// ---------- Угадай вопрос ----------
export type QuizItem = { qid: number; options: number[] };

/** 4 варианта: правильный и 3 вопроса, по возможности из того же раздела. */
export function quizOptions(qid: number, rnd = Math.random): number[] {
  const q = byId.get(qid)!;
  const same = shuffle(QUESTIONS.filter((x) => x.section === q.section && x.id !== qid), rnd).map((x) => x.id);
  const other = shuffle(QUESTIONS.filter((x) => x.section !== q.section), rnd).map((x) => x.id);
  return shuffle([qid, ...[...same, ...other].slice(0, 3)], rnd);
}

/** Перемешивает предложения так, чтобы порядок отличался от исходного. */
export function scramble(n: number, rnd = Math.random): number[] {
  const idx = Array.from({ length: n }, (_, i) => i);
  if (n < 2) return idx;
  for (let k = 0; k < 10; k++) {
    const s = shuffle(idx, rnd);
    if (s.some((v, i) => v !== i)) return s;
  }
  return idx.slice().reverse();
}

/** Доля предложений, стоящих на своем месте. */
export function orderScore(order: number[]): number {
  if (!order.length) return 0;
  return order.filter((v, i) => v === i).length / order.length;
}

/** Зачет: обычный при 60% баллов («знаю» = 1, «почти» = 0,5), строгий только при всех «знаю». */
export function passed(grades: Grade[], strict: boolean): boolean {
  if (strict) return grades.every((g) => g === 2);
  const pts = grades.reduce<number>((a, g) => a + (g === 2 ? 1 : g === 1 ? 0.5 : 0), 0);
  return pts >= grades.length * 0.6;
}
