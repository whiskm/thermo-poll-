import { describe, expect, it } from 'vitest';
import { QUESTIONS, byId } from '../src/content';
import { buildCloze, buildQueue, orderScore, passed, quizOptions, scramble } from '../src/learn';
import { mergeStates, parseFile, makeBackup } from '../src/io';
import { schedule, statusOf } from '../src/srs';
import { emptyState } from '../src/store';
import { fuzzyEqual, splitMath, termFound, termsFor } from '../src/text';
import { formatDuration } from '../src/stats';

const NOW = Date.UTC(2026, 10, 20, 12);
const DAY = 86400000;

describe('контент', () => {
  it('69 вопросов, у каждого 3-5 предложений и найденные термины', () => {
    expect(QUESTIONS).toHaveLength(69);
    for (const q of QUESTIONS) {
      expect(q.answer.length).toBeGreaterThanOrEqual(3);
      expect(q.answer.length).toBeLessThanOrEqual(5);
      expect(termsFor(q.keyTerms, q.answer).length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('интервальное повторение', () => {
  it('«не знаю» возвращает через 10 минут, «знаю» растит интервал 1, 3, 8 дней', () => {
    const bad = schedule(undefined, 0, NOW);
    expect(bad.due - NOW).toBe(10 * 60000);
    let c = schedule(undefined, 2, NOW);
    expect(c.interval).toBe(1);
    c = schedule(c, 2, NOW);
    expect(c.interval).toBe(3);
    c = schedule(c, 2, NOW);
    expect(c.interval).toBe(8);
    expect(statusOf(c)).toBe('good');
  });
  it('очередь «по расписанию» ставит просроченные раньше новых', () => {
    const s = emptyState();
    s.cards[5] = schedule(undefined, 0, NOW - DAY);
    s.cards[6] = schedule(undefined, 2, NOW);
    const q = buildQueue({ source: 'due', sections: [], count: 3 }, s, NOW);
    expect(q).toEqual([5, 1, 2]);
  });
});

describe('проверка ответов', () => {
  it('термины находятся с другими окончаниями', () => {
    expect(termFound('внутреннюю энергию', 'тут внутренняя энергия газа')).toBe(true);
    expect(termFound('уравнением Майера', 'по уравнению майера')).toBe(true);
    expect(termFound('энтропия растет', 'энтальпия растет')).toBe(false);
  });
  it('пропуск засчитывается с одной опечаткой', () => {
    expect(fuzzyEqual('изолированая', 'изолированная')).toBe(true);
    expect(fuzzyEqual('открытые', 'закрытые')).toBe(false);
  });
  it('формулы отделяются от текста', () => {
    expect(splitMath('а $x$ б')).toEqual([
      { kind: 'text', v: 'а ' },
      { kind: 'math', v: 'x' },
      { kind: 'text', v: ' б' },
    ]);
  });
  it('в каждом вопросе есть пропуски, и их ответы лежат в банке', () => {
    for (const q of QUESTIONS) {
      const cz = buildCloze(q, emptyState(), true);
      expect(cz.blanks.length).toBeGreaterThan(0);
      for (const b of cz.blanks) expect(cz.bank.some((x) => x.v === b.answer)).toBe(true);
    }
  });
  it('варианты теста уникальны и содержат правильный', () => {
    for (const q of QUESTIONS) {
      const o = quizOptions(q.id);
      expect(new Set(o).size).toBe(4);
      expect(o).toContain(q.id);
    }
  });
  it('перемешанный порядок отличается от исходного', () => {
    const s = scramble(5);
    expect(orderScore(s)).toBeLessThan(1);
    expect(orderScore([0, 1, 2])).toBe(1);
  });
});

describe('зачет', () => {
  it('обычный: 60% баллов, строгий: все «знаю»', () => {
    expect(passed([2, 1, 0], false)).toBe(false);
    expect(passed([2, 2, 0], false)).toBe(true);
    expect(passed([2, 1, 1], false)).toBe(true);
    expect(passed([2, 2, 1], true)).toBe(false);
    expect(passed([2, 2, 2, 2], true)).toBe(true);
  });
});

describe('перенос данных', () => {
  it('объединение берет более свежую оценку и складывает зачеты', () => {
    const a = emptyState();
    const b = emptyState();
    a.cards[1] = schedule(undefined, 0, NOW - DAY);
    b.cards[1] = schedule(undefined, 2, NOW);
    a.cards[2] = schedule(undefined, 1, NOW);
    a.exams.push({ id: 'x', at: NOW, qids: [1], grades: [2], strict: false, passed: true, seconds: 60 });
    b.exams.push({ id: 'y', at: NOW - DAY, qids: [2], grades: [0], strict: false, passed: false, seconds: 60 });
    b.edits[3] = { answer: ['новый'], updatedAt: NOW };
    const m = mergeStates(a, b);
    expect(m.cards[1].last).toBe(2);
    expect(m.cards[2].last).toBe(1);
    expect(m.exams.map((e) => e.id)).toEqual(['x', 'y']);
    expect(m.edits[3].answer).toEqual(['новый']);
  });
  it('файл экспорта читается обратно, чужой файл отклоняется', () => {
    const s = emptyState();
    s.favorites[7] = NOW;
    const p = parseFile(JSON.stringify(makeBackup(s)));
    expect(p.kind).toBe('backup');
    expect(() => parseFile('{"app":"other"}')).toThrow(/другого приложения/);
    expect(() => parseFile('не json')).toThrow(/не читается/);
    expect(byId.get(7)).toBeTruthy();
  });
});

describe('время в занятиях', () => {
  it('до часа в минутах, дальше в часах с десятыми', () => {
    expect(formatDuration(0)).toBe('0 мин');
    expect(formatDuration(40 * 60)).toBe('40 мин');
    expect(formatDuration(3600)).toBe('1,0 ч');
    expect(formatDuration(5 * 3600 + 10 * 60)).toBe('5,2 ч');
  });
});
