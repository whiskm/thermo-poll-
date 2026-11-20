import { useMemo, useState, type ReactNode } from 'react';
import { GradeBar, MathBlock, Progress, QHead, Tex } from '../components';
import { byId } from '../content';
import { answerOf } from '../learn';
import { GRADE_LABEL, gradeFromScore, type Grade } from '../srs';
import { getState, grade } from '../store';
import { lowerRu, splitMath, termFound, termsFor } from '../text';
import type { ModeProps, Result } from '../screens/Session';

/** Подсвечивает термины в тексте ответа: названные зеленым, пропущенные красным. */
function Highlighted({ s, terms, found }: { s: string; terms: string[]; found: Set<string> }) {
  const out: ReactNode[] = [];
  splitMath(s).forEach((p, pi) => {
    if (p.kind === 'math') {
      out.push(<Tex key={pi} s={`$${p.v}$`} />);
      return;
    }
    let rest = p.v;
    let k = 0;
    for (;;) {
      const low = lowerRu(rest);
      let best = -1;
      let term = '';
      for (const t of terms) {
        const idx = low.indexOf(lowerRu(t));
        if (idx >= 0 && (best < 0 || idx < best)) {
          best = idx;
          term = t;
        }
      }
      if (best < 0) break;
      out.push(<span key={`${pi}-${k++}`}>{rest.slice(0, best)}</span>);
      out.push(
        <mark key={`${pi}-${k++}`} className={found.has(term) ? 'found' : 'miss'}>
          {rest.slice(best, best + term.length)}
        </mark>,
      );
      rest = rest.slice(best + term.length);
    }
    out.push(<span key={`${pi}-end`}>{rest}</span>);
  });
  return <>{out}</>;
}

export function Recall({ ids, onDone }: ModeProps) {
  const [i, setI] = useState(0);
  const [text, setText] = useState('');
  const [checked, setChecked] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const q = byId.get(ids[i])!;
  const answer = useMemo(() => answerOf(q, getState()), [q]);
  const terms = useMemo(() => termsFor(q.keyTerms, answer), [q, answer]);
  const found = useMemo(() => new Set(checked ? terms.filter((t) => termFound(t, text)) : []), [checked, terms, text]);
  const score = terms.length ? found.size / terms.length : 0;
  const suggested = gradeFromScore(score);

  function onGrade(g: Grade) {
    grade(q.id, g);
    const res = [...results, { qid: q.id, g }];
    setResults(res);
    if (i + 1 >= ids.length) return onDone(res);
    setI(i + 1);
    setText('');
    setChecked(false);
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
        <label className="field">
          <span className="sr">Ваш ответ</span>
          <textarea className="input" value={text} disabled={checked} placeholder="Напишите ответ своими словами. Голосом удобно через микрофон на клавиатуре телефона."
            onChange={(e) => setText(e.target.value)} />
        </label>
        {checked && (
          <>
            <p className={`notice ${score >= 0.85 ? 'ok' : score < 0.5 ? 'err' : ''}`} style={{ marginTop: 12 }}>
              Названо терминов: {found.size} из {terms.length}. Предлагаемая оценка: {GRADE_LABEL[suggested]}.
            </p>
            <div className="terms">
              {terms.map((t) => (
                <span key={t} className={`term ${found.has(t) ? 'ok' : 'bad'}`}>{t}</span>
              ))}
            </div>
            <p className="small muted" style={{ margin: '14px 0 0' }}>Эталонный ответ:</p>
            <ol className="answer">
              {answer.map((s, k) => (
                <li key={k}><Highlighted s={s} terms={terms} found={found} /></li>
              ))}
            </ol>
            {q.formulas.length > 0 && (
              <div className="formulas">{q.formulas.map((f, k) => <MathBlock key={k} tex={f} />)}</div>
            )}
          </>
        )}
      </article>
      {!checked ? (
        <button className="btn big block" style={{ marginTop: 16 }} disabled={!text.trim()} onClick={() => setChecked(true)}>
          Проверить
        </button>
      ) : (
        <>
          <p className="small muted center" style={{ margin: '14px 0 0' }}>Оцените себя сами: термины показывают только полноту ответа.</p>
          <GradeBar onGrade={onGrade} />
        </>
      )}
    </>
  );
}
