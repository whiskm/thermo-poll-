import { useCallback, useEffect, useState } from 'react';
import { AnswerView, GradeBar, Progress, QHead, Tex } from '../components';
import { byId } from '../content';
import { answerOf } from '../learn';
import type { Grade } from '../srs';
import { grade, getState, useStore } from '../store';
import type { ModeProps, Result } from '../screens/Session';

export function Cards({ ids, onDone }: ModeProps) {
  const [i, setI] = useState(0);
  const [side, setSide] = useState<'front' | 'back'>('front');
  const [anim, setAnim] = useState<'' | 'flip-a' | 'flip-b'>('');
  const [results, setResults] = useState<Result[]>([]);
  const s = useStore((x) => x);
  const q = byId.get(ids[i])!;

  const flip = useCallback(() => {
    if (side === 'back' || anim) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) setSide('back');
    else setAnim('flip-a');
  }, [side, anim]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.key === ' ' || e.key === 'Enter') && side === 'front') {
        e.preventDefault();
        flip();
      }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [flip, side]);

  const onGrade = useCallback(
    (g: Grade) => {
      grade(q.id, g);
      const next = [...results, { qid: q.id, g }];
      setResults(next);
      if (i + 1 >= ids.length) onDone(next);
      else {
        setI(i + 1);
        setSide('front');
        setAnim('');
      }
    },
    [q.id, results, i, ids.length, onDone],
  );

  return (
    <>
      <div className="row small muted">
        <span>
          {i + 1} из {ids.length}
        </span>
      </div>
      <Progress value={i / ids.length} />
      <article
        className={`panel qcard ${anim}`}
        onClick={side === 'front' ? flip : undefined}
        onAnimationEnd={() => {
          if (anim === 'flip-a') {
            setSide('back');
            setAnim('flip-b');
          } else setAnim('');
        }}
        style={{ cursor: side === 'front' ? 'pointer' : 'auto', minHeight: 220 }}
      >
        <QHead q={q} />
        <p className="qtext">
          <Tex s={q.question} />
        </p>
        {side === 'front' ? (
          <p className="tap-hint">Вспомните ответ и нажмите на карточку, чтобы проверить себя.</p>
        ) : (
          <AnswerView q={q} answer={answerOf(q, s)} note={s.notes[q.id]?.text} edited={Boolean(s.edits[q.id])} />
        )}
      </article>
      {side === 'front' ? (
        <button className="btn big block" style={{ marginTop: 16 }} onClick={flip}>
          Показать ответ
        </button>
      ) : (
        <GradeBar onGrade={onGrade} />
      )}
      {side === 'back' && (
        <p className="small muted center" style={{ marginTop: 10 }}>
          «Не знаю» вернет вопрос через 10 минут, «Почти» через день, «Знаю» через {nextInterval(getState().cards[q.id]?.reps ?? 0)}.
        </p>
      )}
    </>
  );
}

function nextInterval(reps: number): string {
  return reps === 0 ? '1 день' : reps === 1 ? '3 дня' : 'неделю и больше';
}
