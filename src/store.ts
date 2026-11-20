import { useSyncExternalStore } from 'react';
import { get as idbGet, set as idbSet } from 'idb-keyval';
import { schedule, type Card, type Grade } from './srs';

export type Edit = { answer: string[]; updatedAt: number };
export type Note = { text: string; updatedAt: number };
export type ExamRecord = {
  id: string;
  at: number;
  qids: number[];
  grades: Grade[];
  strict: boolean;
  passed: boolean;
  seconds: number;
};
export type Settings = {
  theme: 'system' | 'light' | 'dark';
  examDate: string; // YYYY-MM-DD или пустая строка
  dailyGoal: number;
  prepMinutes: number;
  examCount: number;
  strict: boolean;
};
export type Day = { n: number; sec: number };
export type State = {
  v: 1;
  cards: Record<number, Card>;
  edits: Record<number, Edit>;
  notes: Record<number, Note>;
  favorites: Record<number, number>;
  activity: Record<string, Day>;
  exams: ExamRecord[];
  settings: Settings;
};

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  examDate: '',
  dailyGoal: 15,
  prepMinutes: 5,
  examCount: 3,
  strict: false,
};

export function emptyState(): State {
  return { v: 1, cards: {}, edits: {}, notes: {}, favorites: {}, activity: {}, exams: [], settings: { ...DEFAULT_SETTINGS } };
}

const KEY = 'thermo-opros-state';
let state: State = emptyState();
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let lastAction = 0;

export function dayKey(t: number = Date.now()): string {
  const d = new Date(t);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Дополняет загруженные данные недостающими полями. */
export function sanitize(raw: unknown): State {
  const base = emptyState();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<State>;
  return {
    v: 1,
    cards: { ...(r.cards ?? {}) },
    edits: { ...(r.edits ?? {}) },
    notes: { ...(r.notes ?? {}) },
    favorites: { ...(r.favorites ?? {}) },
    activity: { ...(r.activity ?? {}) },
    exams: Array.isArray(r.exams) ? r.exams.slice() : [],
    settings: { ...DEFAULT_SETTINGS, ...(r.settings ?? {}) },
  };
}

export async function loadState(): Promise<void> {
  let raw: unknown;
  try {
    raw = await idbGet(KEY);
  } catch {
    raw = undefined;
  }
  if (!raw) {
    try {
      const ls = localStorage.getItem(KEY);
      if (ls) raw = JSON.parse(ls);
    } catch {
      raw = undefined;
    }
  }
  state = sanitize(raw);
  try {
    await navigator.storage?.persist?.();
  } catch {
    /* браузер может отказать, данные все равно сохраняются */
  }
}

function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    idbSet(KEY, state).catch(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify(state));
      } catch {
        /* хранилище недоступно */
      }
    });
  }, 250);
}

export function flush() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = undefined;
    idbSet(KEY, state).catch(() => undefined);
  }
}

function commit(next: State) {
  state = next;
  persist();
  listeners.forEach((l) => l());
}

export function getState(): State {
  return state;
}

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => sel(state));
}

/** Записывает оценку вопроса и активность за сегодня. */
export function grade(qid: number, g: Grade) {
  const now = Date.now();
  const key = dayKey(now);
  const day = state.activity[key] ?? { n: 0, sec: 0 };
  const gap = lastAction ? Math.min((now - lastAction) / 1000, 120) : 30;
  lastAction = now;
  commit({
    ...state,
    cards: { ...state.cards, [qid]: schedule(state.cards[qid], g, now) },
    activity: { ...state.activity, [key]: { n: day.n + 1, sec: Math.round(day.sec + gap) } },
  });
}

export function toggleFavorite(qid: number) {
  const favorites = { ...state.favorites };
  if (favorites[qid]) delete favorites[qid];
  else favorites[qid] = Date.now();
  commit({ ...state, favorites });
}

export function saveNote(qid: number, text: string) {
  const notes = { ...state.notes };
  if (text.trim()) notes[qid] = { text, updatedAt: Date.now() };
  else delete notes[qid];
  commit({ ...state, notes });
}

export function saveEdit(qid: number, answer: string[]) {
  commit({ ...state, edits: { ...state.edits, [qid]: { answer, updatedAt: Date.now() } } });
}

export function resetEdit(qid: number) {
  const edits = { ...state.edits };
  delete edits[qid];
  commit({ ...state, edits });
}

export function addExam(rec: ExamRecord) {
  commit({ ...state, exams: [rec, ...state.exams].slice(0, 200) });
}

export function setSettings(patch: Partial<Settings>) {
  commit({ ...state, settings: { ...state.settings, ...patch } });
}

export function replaceState(next: State) {
  commit(sanitize(next));
}

export function resetProgress() {
  commit({ ...state, cards: {}, activity: {}, exams: [] });
}
