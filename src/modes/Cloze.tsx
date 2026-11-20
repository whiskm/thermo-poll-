import { useMemo, useState } from 'react';
import { MathInline, Progress, QHead, Tex } from '../components';
import { byId } from '../content';
import { buildCloze } from '../learn';
import { GRADE_LABEL, gradeFromScore } from '../srs';
import { getState, grade } from '../store';
import { fuzzyEqual, lowerRu } from '../text';
import type { ModeProps, Result } from '../screens/Session';

export function ClozeMode({ ids, opts, onDone }: ModeProps) {
  const [i, setI] = useState(0);
  const [results, setResults] = useState<Result[]>([]);
  const q = byId.get(ids[i])!;
  const cz = useMemo(() => buildCloze(q, getState(), opts.withMath), [q, opts.withMath]);
  const [fills, setFills] = useState<Record<number, { v: string; bank?: number }>>({});
  const [active, setActive] = useState<number | null>(cz.blanks[0]?.id ?? null);
  const [checked, setChecked] = useState(false);

  const usesBank = (b: { math: boolean }) => b.math || !opts.typed;
  const bank = cz.bank.map((b, idx) => ({ ...b, idx })).filter((b) => b.math || !opts.typed);
  const usedBank = new Set(Object.values(fills).map((f) => f.bank).filter((x) => x !== undefined));

  const isRight = (id: number) => {
    const b = cz.blanks[id];
    const f = fills[id]?.v ?? '';
    return usesBank(b) ? lowerRu(f) === lowerRu(b.answer) : fuzzyEqual(f, b.answer);
  };
  const right = cz.blanks.filter((b) => isRight(b.id)).length;
  const score = cz.blanks.length ? right / cz.blanks.length : 1;
  const filled = cz.blanks.every((b) => fills[b.id]?.v?.trim());

  function nextEmpty(after: Record<number, { v: string }>, from: number | null) {
    const order = cz.blanks.filter((b) => usesBank(b)).map((b) => b.id);
    const start = from === null ? 0 : order.indexOf(from) + 1;
    return [...order.slice(start), ...order.slice(0, start)].find((id) => !after[id]?.v) ?? null;
  }

  function pick(idx: number) {
    if (checked) return;
    const item = cz.bank[idx];
    const target =
      active !== null && cz.blanks[active].math === item.math && usesBank(cz.blanks[active])
        ? active
        : cz.blanks.find((b) => b.math === item.math && usesBank(b) && !fills[b.id]?.v)?.id ?? null;
    if (target === null) return;
    const next = { ...fills, [target]: { v: item.v, bank: idx } };
    setFills(next);
    setActive(nextEmpty(next, target));
  }

  function clear(id: number) {
    if (checked) return;
    const next = { ...fills };
    delete next[id];
    setFills(next);
    setActive(id);
  }

  function finish() {
    const g = gradeFromScore(score);
    grade(q.id, g);
    const res = [...results, { qid: q.id, g }];
    setResults(res);
    if (i + 1 >= ids.length) return onDone(res);
    const nq = byId.get(ids[i + 1])!;
    const ncz = buildCloze(nq, getState(), opts.withMath);
    setI(i + 1);
    setFills({});
    setChecked(false);
    setActive(ncz.blanks[0]?.id ?? null);
  }

  return (
    <>
      <div className="row small muted">
        <span>{i + 1} из {ids.length}</span>
        <span className="spacer" />
        <span>Пропусков: {cz.blanks.length}</span>
      </div>
      <Progress value={i / ids.length} />
      <article className="panel">
        <QHead q={q} />
        <p className="qtext" style={{ fontSize: 17 }}><Tex s={q.question} /></p>
        <div className="cloze" style={{ marginTop: 12 }}>
          {cz.sentences.map((segs, si) => (
            <p key={si}>
              {segs.map((sg, k) => {
                if (sg.kind === 'text') return <span key={k}>{sg.v}</span>;
                if (sg.kind === 'math') return <MathInline key={k} tex={sg.v} />;
                const b = cz.blanks[sg.id];
                const st = checked ? (isRight(b.id) ? 'ok' : 'bad') : active === b.id ? 'active' : '';
                const f = fills[b.id]?.v;
                if (!usesBank(b)) {
                  return (
                    <span key={k} className={`blank ${st}`}>
                      <input value={f ?? ''} disabled={checked} aria-label={`Пропуск ${b.id + 1}`} autoCapitalize="off" autoComplete="off"
                        onChange={(e) => setFills({ ...fills, [b.id]: { v: e.target.value } })}
                        onKeyDown={(e) => e.key === 'Enter' && filled && setChecked(true)} />
                      {checked && !isRight(b.id) && <span className="fix">{b.answer}</span>}
                    </span>
                  );
                }
                return (
                  <button key={k} className={`blank ${st}`} aria-label={`Пропуск ${b.id + 1}`}
                    onClick={() => (f ? clear(b.id) : setActive(b.id))}>
                    {f ? (b.math ? <MathInline tex={f} /> : f) : ' '}
                    {checked && !isRight(b.id) && (
                      <span className="fix">{b.math ? <MathInline tex={b.answer} /> : b.answer}</span>
                    )}
                  </button>
                );
              })}
            </p>
          ))}
        </div>
        {bank.length > 0 && !checked && (
          <div className="bank" aria-label="Варианты">
            {bank.map((b) => (
              <button key={b.idx} disabled={usedBank.has(b.idx) || !cz.blanks.some((x) => x.math === b.math && usesBank(x) && !fills[x.id]?.v)}
                onClick={() => pick(b.idx)}>
                {b.math ? <MathInline tex={b.v} /> : b.v}
              </button>
            ))}
          </div>
        )}
        {checked && (
          <p className={`notice ${score >= 0.85 ? 'ok' : score < 0.5 ? 'err' : ''}`} style={{ marginTop: 14 }}>
            Верно {right} из {cz.blanks.length}. Оценка: {GRADE_LABEL[gradeFromScore(score)]}.
          </p>
        )}
      </article>
      {!checked ? (
        <button className="btn big block" style={{ marginTop: 16 }} disabled={!filled} onClick={() => setChecked(true)}>
          Проверить
        </button>
      ) : (
        <button className="btn big block" style={{ marginTop: 16 }} onClick={finish}>
          {i + 1 >= ids.length ? 'Завершить' : 'Следующий вопрос'}
        </button>
      )}
    </>
  );
}
