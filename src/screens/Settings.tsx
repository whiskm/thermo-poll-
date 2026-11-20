import { useRef, useState } from 'react';
import { Download, Upload, Share2 } from 'lucide-react';
import { Seg, Sheet, Top, ask, toast } from '../components';
import { makeBackup, makeEdits, mergeEdits, mergeStates, parseFile, saveTextFile, stamp, type Parsed } from '../io';
import { getState, replaceState, resetProgress, setSettings, useStore } from '../store';
import { plural } from '../text';
import { isNative } from '../platform';

export function Settings() {
  const st = useStore((s) => s.settings);
  const editsN = useStore((s) => Object.keys(s.edits).length);
  const notesN = useStore((s) => Object.keys(s.notes).length);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Parsed | null>(null);
  const [error, setError] = useState('');

  async function save(kind: 'backup' | 'edits') {
    const s = getState();
    const data = kind === 'backup' ? makeBackup(s) : makeEdits(s);
    const name = kind === 'backup' ? `termoopros-${stamp()}.json` : `termoopros-otvety-${stamp()}.json`;
    try {
      const how = await saveTextFile(name, JSON.stringify(data));
      if (how === 'shared') toast('Файл передан');
      else if (how === 'saved') toast('Файл сохранен');
      else if (how === 'downloaded') toast(`Файл ${name} сохранен в загрузки`);
    } catch (e) {
      toast(`Файл не сохранен: ${(e as Error)?.message ?? e}`);
    }
  }

  async function onFile(f: File | undefined) {
    setError('');
    if (!f) return;
    try {
      setPending(parseFile(await f.text()));
    } catch (e) {
      setError((e as Error).message);
    }
    if (fileRef.current) fileRef.current.value = '';
  }

  function apply(mode: 'replace' | 'merge') {
    if (!pending) return;
    const cur = getState();
    if (pending.kind === 'backup') replaceState(mode === 'replace' ? { ...pending.data } : mergeStates(cur, pending.data));
    else replaceState(mergeEdits(cur, pending.edits, pending.notes));
    setPending(null);
    toast('Данные загружены');
  }

  return (
    <>
      <Top title="Настройки" backTo="/learn" />
      <div className="panel">
        <label className="field" style={{ marginTop: 0 }}><span>Тема</span></label>
        <Seg label="Тема" value={st.theme} onChange={(v) => setSettings({ theme: v })}
          options={[{ v: 'system', label: 'Как в системе' }, { v: 'light', label: 'Светлая' }, { v: 'dark', label: 'Темная' }]} />
        <label className="field">
          <span>Дата зачета</span>
          <input className="input" type="date" value={st.examDate} onChange={(e) => setSettings({ examDate: e.target.value })} />
        </label>
        <label className="field"><span>Минимум ответов в день</span></label>
        <div className="stepper">
          <button className="btn ghost" aria-label="Меньше" disabled={st.dailyGoal <= 5} onClick={() => setSettings({ dailyGoal: st.dailyGoal - 5 })}>−</button>
          <b>{st.dailyGoal}</b>
          <button className="btn ghost" aria-label="Больше" disabled={st.dailyGoal >= 100} onClick={() => setSettings({ dailyGoal: st.dailyGoal + 5 })}>+</button>
        </div>
        <p className="small muted" style={{ margin: '8px 0 0' }}>Если задана дата зачета, норма растет так, чтобы успеть выучить все вопросы.</p>
      </div>

      <h2 className="h2">Перенос данных</h2>
      <div className="panel">
        <p style={{ marginTop: 0 }}>
          Прогресс хранится только на этом устройстве. Чтобы перенести его на телефон или компьютер, сохраните файл и загрузите его там.
        </p>
        <div className="stack">
          <button className="btn block" onClick={() => save('backup')}><Download size={18} />Сохранить все в файл</button>
          <button className="btn ghost block" onClick={() => save('edits')} disabled={!editsN && !notesN}>
            <Share2 size={18} />Поделиться своими ответами ({editsN} {plural(editsN, 'ответ', 'ответа', 'ответов')}, {notesN} {plural(notesN, 'заметка', 'заметки', 'заметок')})
          </button>
          <button className="btn ghost block" onClick={() => fileRef.current?.click()}><Upload size={18} />Загрузить из файла</button>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        </div>
        {error && <p className="notice err" style={{ marginBottom: 0 }}>{error}</p>}
      </div>

      <h2 className="h2">Сброс</h2>
      <div className="panel">
        <p style={{ marginTop: 0 }}>Сброс удаляет оценки, статистику и историю зачетов. Свои ответы, заметки и избранное остаются.</p>
        <button className="btn danger" onClick={async () => {
          if (await ask('Удалить оценки, статистику и историю зачетов? Отменить это нельзя.', 'Сбросить прогресс')) {
            resetProgress();
            toast('Прогресс сброшен');
          }
        }}>Сбросить прогресс</button>
      </div>

      <p className="small muted center" style={{ marginTop: 24 }}>
        ТермоОпрос {__APP_VERSION__}.{' '}
        {isNative() ? (
          'Новые версии: github.com/whiskm/thermo-poll-/releases'
        ) : (
          <a href="https://github.com/whiskm/thermo-poll-/releases" target="_blank" rel="noreferrer">Версии для Android и Windows</a>
        )}
      </p>

      {pending && (
        <Sheet title="Загрузка данных" onClose={() => setPending(null)}>
          {pending.kind === 'backup' ? (
            <>
              <p style={{ marginTop: 0 }}>В файле полный прогресс. Как загрузить?</p>
              <div className="stack">
                <button className="btn block" onClick={() => apply('merge')}>Объединить с текущим</button>
                <p className="small muted" style={{ margin: '4px 0 0' }}>По каждому вопросу останется более свежая оценка, история зачетов сложится.</p>
                <button className="btn ghost block" onClick={() => apply('replace')}>Заменить текущий</button>
                <p className="small muted" style={{ margin: '4px 0 0' }}>Данные на этом устройстве удалятся и заменятся данными из файла.</p>
              </div>
            </>
          ) : (
            <>
              <p style={{ marginTop: 0 }}>
                В файле {Object.keys(pending.edits).length} своих ответов и {Object.keys(pending.notes).length} заметок. При совпадении вопросов останется более свежая версия.
              </p>
              <button className="btn block" onClick={() => apply('merge')}>Загрузить ответы</button>
            </>
          )}
        </Sheet>
      )}
    </>
  );
}
