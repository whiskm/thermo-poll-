export type Part = { kind: 'text' | 'math'; v: string };

/** Делит строку на текст и формулы между знаками $. */
export function splitMath(s: string): Part[] {
  const out: Part[] = [];
  const re = /\$([^$]+)\$/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push({ kind: 'text', v: s.slice(last, m.index) });
    out.push({ kind: 'math', v: m[1] });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ kind: 'text', v: s.slice(last) });
  return out;
}

/** Текст без формул: для поиска и сравнения. */
export function plain(s: string): string {
  return s.replace(/\$[^$]+\$/g, ' ');
}

/** Нижний регистр, ё заменена на е. Длина строки не меняется. */
export function lowerRu(s: string): string {
  return s.toLowerCase().replace(/ё/g, 'е');
}

export function normalize(s: string): string {
  return lowerRu(s)
    .replace(/[^a-zа-я0-9%°]+/gi, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

/** Ответ, вписанный в пропуск, засчитывается с опечаткой примерно на каждые 6 букв. */
export function fuzzyEqual(input: string, answer: string): boolean {
  const a = normalize(input);
  const b = normalize(answer);
  if (!a) return false;
  if (a === b) return true;
  return levenshtein(a, b) <= Math.max(1, Math.floor(b.length / 6));
}

function words(s: string): string[] {
  return normalize(plain(s)).split(' ').filter(Boolean);
}

/** Слова совпадают по основе: общий префикс не короче 4 букв и 70% длины. */
function stemMatch(w: string, t: string): boolean {
  if (w === t) return true;
  const need = Math.min(t.length, Math.max(4, Math.ceil(t.length * 0.7)));
  if (w.length < need) return false;
  return w.slice(0, need) === t.slice(0, need);
}

/** Есть ли термин в тексте студента с учетом окончаний. */
export function termFound(term: string, text: string): boolean {
  const tw = words(term).filter((w) => w.length >= 3 || /\d/.test(w));
  if (!tw.length) return false;
  const have = words(text);
  return tw.every((t) => have.some((w) => stemMatch(w, t)));
}

/** Ключевые термины, которые реально есть в тексте ответа. Если их меньше двух, добавляются длинные слова. */
export function termsFor(keyTerms: string[], answer: string[]): string[] {
  const body = lowerRu(plain(answer.join(' ')));
  const found = keyTerms.filter((t) => body.includes(lowerRu(t)));
  if (found.length >= 2) return found;
  const extra = Array.from(new Set(plain(answer.join(' ')).match(/[А-Яа-яЁё-]{9,}/g) ?? []))
    .sort((a, b) => b.length - a.length)
    .slice(0, 4 - found.length);
  return [...found, ...extra];
}

export function shuffle<T>(arr: T[], rnd: () => number = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
