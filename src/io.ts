import { isCapacitor, isTauri } from './platform';
import { sanitize, type State } from './store';

export const APP_ID = 'ТермоОпрос';

export type BackupFile = { app: string; kind: 'backup'; version: 1; exportedAt: string; data: State };
export type EditsFile = {
  app: string;
  kind: 'edits';
  version: 1;
  exportedAt: string;
  edits: State['edits'];
  notes: State['notes'];
};

export function makeBackup(s: State): BackupFile {
  return { app: APP_ID, kind: 'backup', version: 1, exportedAt: new Date().toISOString(), data: s };
}

export function makeEdits(s: State): EditsFile {
  return { app: APP_ID, kind: 'edits', version: 1, exportedAt: new Date().toISOString(), edits: s.edits, notes: s.notes };
}

export type Parsed = { kind: 'backup'; data: State } | { kind: 'edits'; edits: State['edits']; notes: State['notes'] };

/** Разбирает файл экспорта. Бросает ошибку с понятным текстом. */
export function parseFile(text: string): Parsed {
  let obj: unknown;
  try {
    obj = JSON.parse(text);
  } catch {
    throw new Error('Файл не читается: это не файл экспорта ТермоОпроса.');
  }
  const o = obj as { app?: string; kind?: string; data?: unknown; edits?: State['edits']; notes?: State['notes'] };
  if (!o || o.app !== APP_ID) throw new Error('Это файл другого приложения. Нужен файл, сохраненный в ТермоОпросе.');
  if (o.kind === 'backup' && o.data) return { kind: 'backup', data: sanitize(o.data) };
  if (o.kind === 'edits') return { kind: 'edits', edits: o.edits ?? {}, notes: o.notes ?? {} };
  throw new Error('В файле нет данных ТермоОпроса.');
}

function newer<T extends { updatedAt: number }>(a: Record<number, T>, b: Record<number, T>): Record<number, T> {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) {
    const id = Number(k);
    if (!out[id] || out[id].updatedAt < v.updatedAt) out[id] = v;
  }
  return out;
}

/** Объединение: по каждому вопросу берется более свежая запись, история зачетов складывается. */
export function mergeStates(cur: State, inc: State): State {
  const cards = { ...cur.cards };
  for (const [k, v] of Object.entries(inc.cards)) {
    const id = Number(k);
    if (!cards[id] || cards[id].seen < v.seen) cards[id] = v;
  }
  const activity = { ...cur.activity };
  for (const [k, v] of Object.entries(inc.activity)) {
    const a = activity[k];
    activity[k] = a ? { n: Math.max(a.n, v.n), sec: Math.max(a.sec, v.sec) } : v;
  }
  const seen = new Set(cur.exams.map((e) => e.id));
  const exams = [...cur.exams, ...inc.exams.filter((e) => !seen.has(e.id))].sort((a, b) => b.at - a.at);
  return {
    ...cur,
    cards,
    activity,
    exams,
    edits: newer(cur.edits, inc.edits),
    notes: newer(cur.notes, inc.notes),
    favorites: { ...inc.favorites, ...cur.favorites },
  };
}

export function mergeEdits(cur: State, edits: State['edits'], notes: State['notes']): State {
  return { ...cur, edits: newer(cur.edits, edits), notes: newer(cur.notes, notes) };
}

/**
 * Сохраняет текст в файл.
 * APK: файл пишется во временную папку и открывается окно «Поделиться» (Диск, Telegram, Файлы).
 * Windows: окно «Сохранить как».
 * Браузер: «Поделиться» на телефоне, если он умеет отдавать файлы, иначе обычная загрузка.
 * Возвращает null, если пользователь закрыл окно без сохранения.
 */
export async function saveTextFile(name: string, text: string): Promise<'shared' | 'saved' | 'downloaded' | null> {
  if (isCapacitor()) {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    const res = await Filesystem.writeFile({ path: name, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
    try {
      await Share.share({ title: name, files: [res.uri], dialogTitle: 'Сохранить или отправить файл' });
      return 'shared';
    } catch {
      return null;
    }
  }
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    const ok = await invoke<boolean>('export_file', { name, contents: text });
    return ok ? 'saved' : null;
  }
  const file = new File([text], name, { type: 'application/json' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  if (coarse && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: name });
      return 'shared';
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return null;
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return 'downloaded';
}

export function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
