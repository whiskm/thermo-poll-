import { useMemo, useState } from 'react';
import { Chips, Seg, SectionPicker, Top, useScrollTop } from '../components';
import { byId } from '../content';
import { buildQueue, SOURCE_LABEL, type SessionOpts, type Source } from '../learn';
import { useRoute } from '../router';
import { GRADE_LABEL, type Grade } from '../srs';
import { getState } from '../store';
import { plural } from '../text';
import { MODES } from './Learn';
import { Cards } from '../modes/Cards';
import { ClozeMode } from '../modes/Cloze';
import { Quiz } from '../modes/Quiz';
import { Order } from '../modes/Order';
import { Recall } from '../modes/Recall';

export type Result = { qid: number; g: Grade };
export type ModeOpts = { withMath: boolean; typed: boolean; dir: 'a2q' | 'q2a' | 'mix' };
export type ModeProps = { ids: number[]; opts: ModeOpts; onDone: (r: Result[]) => void };

const RUNNERS: Record<string, (p: ModeProps) => React.ReactElement> = {
  cards: Cards,
  cloze: ClozeMode,
  quiz: Quiz,
  order: Order,
  recall: Recall,
};

const SOURCES: Source[] = ['due', 'weak', 'new', 'fav', 'all'];

export function Session({ mode }: { mode: string }) {
  const r = useRoute();
  const info = MODES.find((m) => m.id === mode) ?? MODES[0];
  const presetIds = r.query.get('ids')?.split(',').map(Number).filter((n) => byId.has(n));
  const presetSrc = r.query.get('src') as Source | null;
  const preset = Boolean(presetIds?.length || presetSrc);
  const weak = presetSrc === 'weak';

  const [opts, setOpts] = useState<SessionOpts>({ source: presetSrc ?? 'due', sections: [], count: 20, ids: presetIds });
  const [mo, setMo] = useState<ModeOpts>({ withMath: true, typed: false, dir: 'mix' });
  const [ids, setIds] = useState<number[]>(() => (preset ? buildQueue(opts, getState()) : []));
  const [phase, setPhase] = useState<'setup' | 'run' | 'done'>(preset ? 'run' : 'setup');
  const [results, setResults] = useState<Result[]>([]);
  const [run, setRun] = useState(0);
  useScrollTop(phase);

  const s = getState();
  const preview = useMemo(() => buildQueue({ ...opts, ids: undefined }, s), [opts, s, phase]);
  const counts = useMemo(() => {
    const c = {} as Record<Source, number>;
    for (const src of SOURCES) c[src] = buildQueue({ source: src, sections: opts.sections, count: 0 }, s).length;
    return c;
  }, [opts.sections, s, phase]);

  const Runner = RUNNERS[mode] ?? Cards;
  const title = weak ? 'Работа над ошибками' : info.title;

  if (phase === 'run') {
    if (!ids.length) {
      return (
        <>
          <Top title={title} backTo="/learn" />
          <div className="panel empty">
            <b>Сейчас повторять нечего</b>
            {weak ? 'Вопросов с оценкой «не знаю» и «почти» нет.' : 'Все вопросы из выборки уже повторены по расписанию.'}
            <div className="row" style={{ justifyContent: 'center', marginTop: 16 }}>
              <button className="btn" onClick={() => setPhase('setup')}>Выбрать вопросы</button>
            </div>
          </div>
        </>
      );
    }
    return (
      <>
        <Top title={title} backTo="/learn" />
        <Runner key={run} ids={ids} opts={mo} onDone={(res) => { setResults(res); setPhase('done'); }} />
      </>
    );
  }

  if (phase === 'done') {
    const by = [0, 0, 0];
    results.forEach((x) => by[x.g]++);
    const retry = results.filter((x) => x.g < 2).map((x) => x.qid);
    return (
      <>
        <Top title="Итог занятия" backTo="/learn" />
        <div className="panel">
          <div className="result-big">{results.length} {plural(results.length, 'вопрос', 'вопроса', 'вопросов')}</div>
          <div className="facts">
            <div className="fact"><b style={{ color: 'var(--hot)' }}>{by[2]}</b><span>знаю</span></div>
            <div className="fact"><b style={{ color: 'var(--warm)' }}>{by[1]}</b><span>почти</span></div>
            <div className="fact"><b style={{ color: 'var(--cold)' }}>{by[0]}</b><span>не знаю</span></div>
          </div>
          <ul className="qlist" style={{ marginTop: 12 }}>
            {results.map((x, i) => (
              <li key={i}>
                <a className="qrow" href={`#/q/${x.qid}`}>
                  <span className="id">{x.qid}</span>
                  <span className="t">{byId.get(x.qid)!.short}</span>
                  <span className="row small muted"><i className={`dot st-${['bad', 'mid', 'good'][x.g]}`} />{GRADE_LABEL[x.g]}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div className="row wrap" style={{ marginTop: 16 }}>
          {retry.length > 0 && (
            <button className="btn" onClick={() => { setIds(retry); setRun(run + 1); setPhase('run'); }}>
              Повторить {retry.length} {plural(retry.length, 'слабый', 'слабых', 'слабых')}
            </button>
          )}
          <button className="btn ghost" onClick={() => setPhase('setup')}>Новое занятие</button>
          <a className="btn ghost" href="#/learn">К режимам</a>
        </div>
      </>
    );
  }

  return (
    <>
      <Top title={title} sub={info.text} backTo="/learn" />
      <div className="panel">
        <label className="field" style={{ marginTop: 0 }}>
          <span>Какие вопросы</span>
        </label>
        <Chips options={SOURCES.map((v) => ({ v, label: `${SOURCE_LABEL[v]} (${counts[v]})` }))} value={[opts.source]}
          onChange={([v]) => setOpts({ ...opts, source: v })} />
        <label className="field"><span>Разделы</span></label>
        <SectionPicker value={opts.sections} onChange={(v) => setOpts({ ...opts, sections: v })} />
        <label className="field"><span>Сколько за раз</span></label>
        <Seg label="Сколько за раз" value={opts.count} onChange={(v) => setOpts({ ...opts, count: v })}
          options={[{ v: 10, label: '10' }, { v: 20, label: '20' }, { v: 40, label: '40' }, { v: 0, label: 'Все' }]} />
        {mode === 'cloze' && (
          <>
            <label className="field"><span>Что пропускать</span></label>
            <Seg label="Что пропускать" value={mo.withMath} onChange={(v) => setMo({ ...mo, withMath: v })}
              options={[{ v: false, label: 'Термины' }, { v: true, label: 'Термины и формулы' }]} />
            <label className="field"><span>Как заполнять</span></label>
            <Seg label="Как заполнять" value={mo.typed} onChange={(v) => setMo({ ...mo, typed: v })}
              options={[{ v: false, label: 'Выбирать слова' }, { v: true, label: 'Печатать' }]} />
          </>
        )}
        {mode === 'quiz' && (
          <>
            <label className="field"><span>Что угадывать</span></label>
            <Seg label="Что угадывать" value={mo.dir} onChange={(v) => setMo({ ...mo, dir: v })}
              options={[{ v: 'a2q', label: 'Вопрос' }, { v: 'q2a', label: 'Ответ' }, { v: 'mix', label: 'Вперемешку' }]} />
          </>
        )}
      </div>
      {preview.length === 0 && (
        <p className="notice" style={{ marginTop: 12 }}>
          В этой выборке нет вопросов. Выберите другой источник или разделы.
        </p>
      )}
      <button className="btn big block" style={{ marginTop: 16 }} disabled={!preview.length}
        onClick={() => { setIds(preview); setRun(run + 1); setPhase('run'); }}>
        Начать: {preview.length} {plural(preview.length, 'вопрос', 'вопроса', 'вопросов')}
      </button>
    </>
  );
}
