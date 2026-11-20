import { useMemo, useState } from 'react';
import { Progress, QHead, Tex } from '../components';
import { byId } from '../content';
import { answerOf, quizOptions } from '../learn';
import { statusOf, type Grade } from '../srs';
import { getState, grade } from '../store';
import type { ModeProps, Result } from '../screens/Session';

/** Первые два предложения ответа: по ним узнают вопрос. */
function snippet(qid: number): string[] {
  return answerOf(byId.get(qid)!, getState()).slice(0, 2);
}

export function Quiz({ ids, opts, onDone }: ModeProps) {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const qid = ids[i];
  const q = byId.get(qid)!;
  const dirs = useMemo(() => ids.map((_, k) => (opts.dir === 'mix' ? (k % 2 ? 'q2a' : 'a2q') : opts.dir)), [ids, opts.dir]);
  const dir = dirs[i];
  const options = useMemo(() => quizOptions(qid), [qid]);
  const done = picked !== null;
  const correct = picked === qid;

  function next() {
    const card = getState().cards[qid];
    const g: Grade = correct ? (statusOf(card) === 'good' ? 2 : 1) : 0;
    grade(qid, g);
    const res = [...results, { qid, g }];
    setResults(res);
    if (i + 1 >= ids.length) return onDone(res);
    setI(i + 1);
    setPicked(null);
  }

  return (
    <>
      <div className="row small muted">
        <span>{i + 1} из {ids.length}</span>
        <span className="spacer" />
        <span>Верно: {results.filter((r) => r.g > 0).length}</span>
      </div>
      <Progress value={i / ids.length} />
      <article className="panel">
        {dir === 'a2q' ? (
          <>
            <div className="qnum"><b>К какому вопросу этот ответ?</b></div>
            <ol className="answer" style={{ marginTop: 4 }}>
              {snippet(qid).map((s, k) => <li key={k}><Tex s={s} /></li>)}
            </ol>
          </>
        ) : (
          <>
            <QHead q={q} />
            <p className="qtext" style={{ fontSize: 17 }}><Tex s={q.question} /></p>
            <p className="small muted" style={{ margin: '8px 0 0' }}>Выберите начало правильного ответа.</p>
          </>
        )}
        <div className="options">
          {options.map((o, k) => {
            const cls = done ? (o === qid ? 'ok' : o === picked ? 'bad' : '') : '';
            return (
              <button key={o} className={`option ${cls}`} disabled={done} onClick={() => setPicked(o)}>
                <span className="n">{k + 1}</span>
                {dir === 'a2q' ? (
                  <><b>№ {o}.</b> <Tex s={byId.get(o)!.question} /></>
                ) : (
                  <Tex s={snippet(o).join(' ')} />
                )}
              </button>
            );
          })}
        </div>
        {done && (
          <p className={`notice ${correct ? 'ok' : 'err'}`} style={{ marginTop: 12 }}>
            {correct ? 'Верно.' : `Неверно. Правильный вариант отмечен зеленым: вопрос № ${qid}.`}
          </p>
        )}
      </article>
      {done && (
        <button className="btn big block" style={{ marginTop: 16 }} onClick={next} autoFocus>
          {i + 1 >= ids.length ? 'Завершить' : 'Следующий вопрос'}
        </button>
      )}
    </>
  );
}
