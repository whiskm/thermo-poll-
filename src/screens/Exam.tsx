import { useEffect, useRef, useState } from 'react';
import { AnswerView, GradeBar, Progress, QHead, Seg, SectionPicker, Tex, Top, useScrollTop } from '../components';
import { QUESTIONS, byId } from '../content';
import { answerOf, passed } from '../learn';
import { GRADE_LABEL, type Grade } from '../srs';
import { addExam, getState, grade, setSettings, useStore } from '../store';
import { plural, shuffle } from '../text';

type Phase = 'setup' | 'prep' | 'answer' | 'result';

function fmtClock(sec: number) {
  const m = Math.floor(Math.abs(sec) / 60);
  const s = Math.abs(sec) % 60;
  return `${sec < 0 ? '−' : ''}${m}:${String(s).padStart(2, '0')}`;
}

export function Exam() {
  const settings = useStore((s) => s.settings);
  const exams = useStore((s) => s.exams);
  const [phase, setPhase] = useState<Phase>('setup');
  const [sections, setSections] = useState<string[]>([]);
  const [ticket, setTicket] = useState<number[]>([]);
  const [extra, setExtra] = useState<number | null>(null);
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(false);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [now, setNow] = useState(Date.now());
  const startPrep = useRef(0);
  const startAll = useRef(0);
  const [seconds, setSeconds] = useState(0);
  useScrollTop(`${phase}-${i}`);

  useEffect(() => {
    if (phase !== 'prep' && phase !== 'answer') return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [phase]);

  const order = extra !== null ? [...ticket, extra] : ticket;

  function draw() {
    const pool = QUESTIONS.filter((q) => !sections.length || sections.includes(q.section)).map((q) => q.id);
    const t = shuffle(pool).slice(0, settings.examCount).sort((a, b) => a - b);
    setTicket(t);
    setExtra(null);
    setGrades([]);
    setI(0);
    setShown(false);
    startPrep.current = Date.now();
    startAll.current = Date.now();
    setNow(Date.now());
    setPhase(settings.prepMinutes > 0 ? 'prep' : 'answer');
  }

  function onGrade(g: Grade) {
    const qid = order[i];
    grade(qid, g);
    const gs = [...grades, g];
    setGrades(gs);
    setShown(false);
    // строгий преподаватель задает дополнительный вопрос, если билет сдан на «знаю»
    if (i + 1 === ticket.length && settings.strict && extra === null && gs.every((x) => x === 2)) {
      const rest = QUESTIONS.map((q) => q.id).filter((id) => !ticket.includes(id) && (!sections.length || sections.includes(byId.get(id)!.section)));
      const pick = shuffle(rest.length ? rest : QUESTIONS.map((q) => q.id).filter((id) => !ticket.includes(id)))[0];
      setExtra(pick);
      setI(i + 1);
      return;
    }
    if (i + 1 < order.length) {
      setI(i + 1);
      return;
    }
    const sec = Math.round((Date.now() - startAll.current) / 1000);
    setSeconds(sec);
    const ids = extra !== null ? [...ticket, extra] : ticket;
    addExam({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, at: Date.now(), qids: ids, grades: gs, strict: settings.strict, passed: passed(gs, settings.strict), seconds: sec });
    setPhase('result');
  }

  if (phase === 'setup') {
    const last = exams.slice(0, 3);
    return (
      <>
        <Top title="Пробный зачет" sub="Билет из случайных вопросов, как у преподавателя" />
        <div className="panel">
          <label className="field" style={{ marginTop: 0 }}><span>Вопросов в билете</span></label>
          <div className="stepper">
            <button className="btn ghost" aria-label="Меньше" disabled={settings.examCount <= 2} onClick={() => setSettings({ examCount: settings.examCount - 1 })}>−</button>
            <b>{settings.examCount}</b>
            <button className="btn ghost" aria-label="Больше" disabled={settings.examCount >= 5} onClick={() => setSettings({ examCount: settings.examCount + 1 })}>+</button>
          </div>
          <label className="field"><span>Время на подготовку</span></label>
          <Seg label="Время на подготовку" value={settings.prepMinutes} onChange={(v) => setSettings({ prepMinutes: v })}
            options={[{ v: 0, label: 'Без' }, { v: 3, label: '3 мин' }, { v: 5, label: '5 мин' }, { v: 10, label: '10 мин' }]} />
          <label className="field"><span>Преподаватель</span></label>
          <Seg label="Преподаватель" value={settings.strict} onChange={(v) => setSettings({ strict: v })}
            options={[{ v: false, label: 'Обычный' }, { v: true, label: 'Строгий' }]} />
          <p className="small muted" style={{ margin: '8px 0 0' }}>
            {settings.strict
              ? 'Зачет только если на все вопросы «знаю». После билета будет дополнительный вопрос.'
              : 'Зачет при 60% баллов: «знаю» дает 1 балл, «почти» 0,5.'}
          </p>
          <label className="field"><span>Разделы</span></label>
          <SectionPicker value={sections} onChange={setSections} />
        </div>
        <button className="btn big block" style={{ marginTop: 16 }} onClick={draw}>Вытянуть билет</button>
        {last.length > 0 && (
          <>
            <h2 className="h2">Последние попытки</h2>
            <div className="panel">
              <ul className="exams">
                {last.map((e) => (
                  <li key={e.id}>
                    <span>{new Date(e.at).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</span>
                    <span className={`verdict ${e.passed ? 'ok' : 'bad'}`} style={{ fontSize: 13, padding: '2px 10px' }}>{e.passed ? 'зачет' : 'незачет'}</span>
                    <span className="muted small">Вопросы: {e.qids.join(', ')}</span>
                  </li>
                ))}
              </ul>
              <a className="btn text" href="#/stats">Вся история в статистике</a>
            </div>
          </>
        )}
      </>
    );
  }

  if (phase === 'prep') {
    const left = settings.prepMinutes * 60 - Math.floor((now - startPrep.current) / 1000);
    return (
      <>
        <Top title="Подготовка" sub="Продумайте ответы, можно делать заметки на бумаге" backTo="/exam" />
        <div className="panel">
          <div className="timer" aria-live="polite" style={{ color: left <= 0 ? 'var(--err)' : undefined }}>{fmtClock(left)}</div>
          <p className="center small muted" style={{ marginTop: 0 }}>{left > 0 ? 'осталось на подготовку' : 'время вышло, пора отвечать'}</p>
          <ol className="ticket">
            {ticket.map((id) => (
              <li key={id}><span><b>№ {id}.</b> <Tex s={byId.get(id)!.question} /></span></li>
            ))}
          </ol>
        </div>
        <button className="btn big block" style={{ marginTop: 16 }} onClick={() => setPhase('answer')}>Начать отвечать</button>
      </>
    );
  }

  if (phase === 'answer') {
    const qid = order[i];
    const q = byId.get(qid)!;
    const s = getState();
    const isExtra = extra !== null && i === ticket.length;
    return (
      <>
        <Top title={isExtra ? 'Дополнительный вопрос' : `Вопрос ${i + 1} из ${ticket.length}`} sub={`Идет ${fmtClock(Math.floor((now - startAll.current) / 1000))}`} backTo="/exam" />
        <Progress value={i / order.length} />
        <article className="panel">
          <QHead q={q} />
          <p className="qtext"><Tex s={q.question} /></p>
          {!shown ? (
            <p className="tap-hint">Ответьте вслух или на бумаге, затем сравните с эталоном и честно оцените себя.</p>
          ) : (
            <AnswerView q={q} answer={answerOf(q, s)} note={s.notes[q.id]?.text} edited={Boolean(s.edits[q.id])} />
          )}
        </article>
        {!shown ? (
          <button className="btn big block" style={{ marginTop: 16 }} onClick={() => setShown(true)}>Показать эталон</button>
        ) : (
          <GradeBar onGrade={onGrade} />
        )}
      </>
    );
  }

  const ok = passed(grades, settings.strict);
  const weak = order.filter((_, k) => grades[k] < 2);
  return (
    <>
      <Top title="Результат" backTo="/exam" />
      <div className="panel center">
        <span className={`verdict ${ok ? 'ok' : 'bad'}`}>{ok ? 'Зачет' : 'Незачет'}</span>
        <p className="muted" style={{ marginBottom: 0 }}>
          {order.length} {plural(order.length, 'вопрос', 'вопроса', 'вопросов')}, {Math.max(1, Math.round(seconds / 60))} мин
          {settings.strict ? ', строгий преподаватель' : ''}
        </p>
      </div>
      <div className="panel">
        <ol className="ticket">
          {order.map((id, k) => (
            <li key={id}>
              <span>
                <a href={`#/q/${id}`}><b>№ {id}.</b></a> {byId.get(id)!.short}
                <span className="row small muted" style={{ marginTop: 4 }}>
                  <i className={`dot st-${['bad', 'mid', 'good'][grades[k]]}`} /> {GRADE_LABEL[grades[k]]}
                  {extra === id ? ', дополнительный' : ''}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </div>
      <div className="row wrap" style={{ marginTop: 16 }}>
        <button className="btn" onClick={draw}>Новый билет</button>
        {weak.length > 0 && <a className="btn ghost" href={`#/learn/cards?ids=${weak.join(',')}`}>Разобрать слабые: {weak.length}</a>}
        <button className="btn ghost" onClick={() => setPhase('setup')}>Настройки зачета</button>
      </div>
    </>
  );
}
