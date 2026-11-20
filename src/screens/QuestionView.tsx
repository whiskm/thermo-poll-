import { useState } from 'react';
import { ChevronLeft, ChevronRight, PenLine, Star, StickyNote, Layers, RotateCcw } from 'lucide-react';
import { AnswerView, Sheet, Tex, Top, ask, toast } from '../components';
import { QUESTIONS, SECTION_SHORT, byId } from '../content';
import { answerOf } from '../learn';
import { STATUS_LABEL, statusOf } from '../srs';
import { resetEdit, saveEdit, saveNote, toggleFavorite, useStore } from '../store';

export function QuestionView({ id }: { id: number }) {
  const s = useStore((x) => x);
  const q = byId.get(id);
  const [sheet, setSheet] = useState<'' | 'edit' | 'note'>('');
  const [draft, setDraft] = useState('');
  if (!q) {
    return (
      <>
        <Top title="Вопрос не найден" backTo="/q" />
        <div className="panel empty"><b>Такого номера нет</b>В списке вопросы с 1 по {QUESTIONS.length}.</div>
      </>
    );
  }
  const card = s.cards[q.id];
  const st = statusOf(card);
  const fav = Boolean(s.favorites[q.id]);
  const edited = Boolean(s.edits[q.id]);
  const answer = answerOf(q, s);
  const prev = id > 1 ? id - 1 : null;
  const next = id < QUESTIONS.length ? id + 1 : null;

  function openEdit() {
    setDraft(answer.join('\n'));
    setSheet('edit');
  }
  function openNote() {
    setDraft(s.notes[q!.id]?.text ?? '');
    setSheet('note');
  }

  return (
    <>
      <Top title={`Вопрос № ${q.id}`} sub={SECTION_SHORT[q.section]} backTo="/q"
        right={
          <button className="icon-btn" aria-pressed={fav} aria-label={fav ? 'Убрать из избранного' : 'В избранное'} onClick={() => toggleFavorite(q.id)}>
            <Star size={22} fill={fav ? 'currentColor' : 'none'} />
          </button>
        } />
      <article className="panel">
        <div className="qnum">
          <i className={`dot st-${st}`} />
          <span>{STATUS_LABEL[st]}{card ? `, оценок: ${card.count}` : ''}</span>
        </div>
        <p className="qtext"><Tex s={q.question} /></p>
        <AnswerView q={q} answer={answer} note={s.notes[q.id]?.text} edited={edited} />
      </article>

      <div className="row wrap" style={{ marginTop: 14 }}>
        <a className="btn" href={`#/learn/cards?ids=${q.id}`}><Layers size={18} />Учить</a>
        <button className="btn ghost" onClick={openEdit}><PenLine size={18} />Изменить ответ</button>
        <button className="btn ghost" onClick={openNote}><StickyNote size={18} />{s.notes[q.id] ? 'Заметка' : 'Добавить заметку'}</button>
      </div>

      <div className="row" style={{ marginTop: 18 }}>
        {prev ? <a className="btn ghost" href={`#/q/${prev}`} aria-label="Предыдущий вопрос"><ChevronLeft size={18} />№ {prev}</a> : <span />}
        <span className="spacer" />
        {next ? <a className="btn ghost" href={`#/q/${next}`} aria-label="Следующий вопрос">№ {next}<ChevronRight size={18} /></a> : null}
      </div>

      {sheet === 'edit' && (
        <Sheet title="Своя формулировка" onClose={() => setSheet('')}>
          <p className="small muted" style={{ marginTop: 0 }}>
            Каждое предложение с новой строки: так ответ работает в режиме «Собери ответ». Формулы пишутся между знаками $, например $pv = RT$.
          </p>
          <textarea className="input" style={{ minHeight: 260 }} value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Текст ответа" />
          <div className="row wrap" style={{ marginTop: 12 }}>
            <button className="btn" disabled={!draft.trim()} onClick={() => {
              const lines = draft.split('\n').map((x) => x.trim()).filter(Boolean);
              saveEdit(q.id, lines);
              setSheet('');
              toast('Ответ сохранен');
            }}>Сохранить</button>
            {edited && (
              <button className="btn ghost" onClick={async () => {
                setSheet('');
                if (await ask('Вернуть исходный ответ? Ваша формулировка удалится.', 'Вернуть исходный')) {
                  resetEdit(q.id);
                  toast('Исходный ответ возвращен');
                }
              }}><RotateCcw size={16} />Вернуть исходный</button>
            )}
          </div>
        </Sheet>
      )}
      {sheet === 'note' && (
        <Sheet title="Заметка к вопросу" onClose={() => setSheet('')}>
          <textarea className="input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Что сказал преподаватель, на чем легко ошибиться" aria-label="Текст заметки" />
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn" onClick={() => {
              saveNote(q.id, draft);
              setSheet('');
              toast(draft.trim() ? 'Заметка сохранена' : 'Заметка удалена');
            }}>Сохранить</button>
          </div>
        </Sheet>
      )}
    </>
  );
}
