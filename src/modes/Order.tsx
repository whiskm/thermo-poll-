import { useMemo, useState } from 'react';
import { Progress, QHead, Tex, useScrollTop } from '../components';
import { byId } from '../content';
import { answerOf, orderScore, scramble } from '../learn';
import { GRADE_LABEL, gradeFromScore } from '../srs';
import { getState, grade } from '../store';
import type { ModeProps, Result } from '../screens/Session';

export function Order({ ids, onDone }: ModeProps) {
  const [i, setI] = useState(0);
  useScrollTop(i);
  const [results, setResults] = useState<Result[]>([]);
  const q = byId.get(ids[i])!;
  const sentences = useMemo(() => answerOf(q, getState()), [q]);
  const shuffled = useMemo(() => scramble(sentences.length), [sentences]);
  const [built, setBuilt] = useState<number[]>([]);
  const checked = built.length === sentences.length;
  const score = checked ? orderScore(built) : 0;

  function finish() {
    const g = gradeFromScore(score);
    grade(q.id, g);
    const res = [...results, { qid: q.id, g }];
    setResults(res);
    if (i + 1 >= ids.length) return onDone(res);
    setI(i + 1);
    setBuilt([]);
  }

  return (
    <>
      <div className="row small muted">
        <span>{i + 1} из {ids.length}</span>
      </div>
      <Progress value={i / ids.length} />
      <article className="panel">
        <QHead q={q} />
        <p className="qtext" style={{ fontSize: 17 }}><Tex s={q.question} /></p>
        <p className="small muted" style={{ margin: '10px 0 6px' }}>
          {checked ? 'Ответ собран.' : 'Нажимайте на предложения в том порядке, в каком отвечали бы преподавателю. Нажатие на собранное предложение возвращает его обратно.'}
        </p>
        <div className="built">
          {built.map((idx, pos) => (
            <button key={idx} className={`piece ${checked ? (idx === pos ? 'ok' : 'bad') : ''}`} disabled={checked}
              onClick={() => setBuilt(built.filter((x) => x !== idx))}>
              <span className="n">{pos + 1}</span>
              <Tex s={sentences[idx]} />
            </button>
          ))}
        </div>
        {!checked && (
          <div style={{ marginTop: 12 }}>
            {shuffled.filter((idx) => !built.includes(idx)).map((idx) => (
              <button key={idx} className="piece" onClick={() => setBuilt([...built, idx])}>
                <Tex s={sentences[idx]} />
              </button>
            ))}
          </div>
        )}
        {checked && (
          <>
            <p className={`notice ${score >= 0.85 ? 'ok' : score < 0.5 ? 'err' : ''}`} style={{ marginTop: 12 }}>
              На своем месте {built.filter((v, k) => v === k).length} из {sentences.length}. Оценка: {GRADE_LABEL[gradeFromScore(score)]}.
            </p>
            {score < 1 && (
              <>
                <p className="small muted" style={{ margin: '12px 0 0' }}>Правильный порядок:</p>
                <ol className="answer">
                  {sentences.map((s, k) => <li key={k}><Tex s={s} /></li>)}
                </ol>
              </>
            )}
          </>
        )}
      </article>
      {checked && (
        <div className="row" style={{ marginTop: 16 }}>
          <button className="btn ghost" onClick={() => setBuilt([])}>Собрать заново</button>
          <button className="btn big" style={{ flex: 1 }} onClick={finish}>
            {i + 1 >= ids.length ? 'Завершить' : 'Следующий вопрос'}
          </button>
        </div>
      )}
    </>
  );
}
