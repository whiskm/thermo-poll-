import { useMemo, useState } from 'react';
import { Search, Star, PenLine, StickyNote } from 'lucide-react';
import { Chips, MathBlock, SectionPicker, Tex, Top } from '../components';
import { QUESTIONS, SECTIONS, byId } from '../content';
import { answerOf } from '../learn';
import { go } from '../router';
import { STATUS_LABEL, statusOf, type Status } from '../srs';
import { useStore } from '../store';
import { lowerRu, plain } from '../text';
import glossary from '../../content/glossary.json';

type Filter = 'all' | Status | 'fav' | 'edited';
const FILTERS: { v: Filter; label: string }[] = [
  { v: 'all', label: 'Все' },
  { v: 'new', label: STATUS_LABEL.new },
  { v: 'bad', label: STATUS_LABEL.bad },
  { v: 'mid', label: STATUS_LABEL.mid },
  { v: 'good', label: STATUS_LABEL.good },
  { v: 'fav', label: 'Избранное' },
  { v: 'edited', label: 'Изменены мной' },
];

function Tabs({ cur }: { cur: 'q' | 'formulas' | 'glossary' }) {
  const items = [
    { v: 'q', label: 'Вопросы' },
    { v: 'formulas', label: 'Формулы' },
    { v: 'glossary', label: 'Термины' },
  ] as const;
  return (
    <div className="seg" role="tablist" aria-label="Справочник" style={{ marginBottom: 12 }}>
      {items.map((t) => (
        <button key={t.v} role="tab" aria-selected={cur === t.v} aria-pressed={cur === t.v} onClick={() => go('/' + t.v)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="search">
      <Search size={20} />
      <input className="input" type="search" value={value} placeholder={placeholder} aria-label={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function Questions() {
  const s = useStore((x) => x);
  const [query, setQuery] = useState('');
  const [sections, setSections] = useState<string[]>([]);
  const [filter, setFilter] = useState<Filter>('all');

  const list = useMemo(() => {
    const ql = lowerRu(query.trim());
    return QUESTIONS.filter((q) => {
      if (sections.length && !sections.includes(q.section)) return false;
      if (filter === 'fav' && !s.favorites[q.id]) return false;
      if (filter === 'edited' && !s.edits[q.id]) return false;
      if (['new', 'bad', 'mid', 'good'].includes(filter) && statusOf(s.cards[q.id]) !== filter) return false;
      if (!ql) return true;
      if (String(q.id) === ql) return true;
      const hay = lowerRu(`${q.short} ${plain(q.question)} ${plain(answerOf(q, s).join(' '))} ${s.notes[q.id]?.text ?? ''}`);
      return ql.split(/\s+/).every((w) => hay.includes(w));
    });
  }, [query, sections, filter, s]);

  return (
    <>
      <Top title="Справочник" sub={`${QUESTIONS.length} вопросов с ответами`} />
      <Tabs cur="q" />
      <SearchBox value={query} onChange={setQuery} placeholder="Поиск по номеру, словам вопроса и ответа" />
      <div style={{ marginTop: 12 }}>
        <Chips options={FILTERS} value={[filter]} onChange={([v]) => setFilter(v)} scroll />
      </div>
      <div style={{ marginTop: 8 }}>
        <SectionPicker value={sections} onChange={setSections} scroll />
      </div>
      <div className="panel" style={{ marginTop: 14, padding: '4px 12px' }}>
        {list.length === 0 && (
          <div className="empty">
            <b>Ничего не найдено</b>
            Измените запрос или сбросьте фильтры.
          </div>
        )}
        {SECTIONS.map((sec) => {
          const items = list.filter((q) => q.section === sec.id);
          if (!items.length) return null;
          return (
            <div key={sec.id}>
              <div className="sec-title">{sec.title}</div>
              <ul className="qlist">
                {items.map((q) => {
                  const st = statusOf(s.cards[q.id]);
                  return (
                    <li key={q.id}>
                      <a className="qrow" href={`#/q/${q.id}`}>
                        <span className="id">{q.id}</span>
                        <span className="t">
                          {q.short}
                          <small>{STATUS_LABEL[st]}</small>
                        </span>
                        <span className="meta">
                          {s.favorites[q.id] ? <Star size={16} fill="currentColor" aria-label="В избранном" /> : null}
                          {s.edits[q.id] ? <PenLine size={16} aria-label="Ответ изменен" /> : null}
                          {s.notes[q.id] ? <StickyNote size={16} aria-label="Есть заметка" /> : null}
                          <i className={`dot st-${st}`} />
                        </span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </>
  );
}

export function Formulas() {
  const [query, setQuery] = useState('');
  const ql = lowerRu(query.trim());
  return (
    <>
      <Top title="Шпаргалка формул" sub="Все формулы курса по вопросам" />
      <Tabs cur="formulas" />
      <SearchBox value={query} onChange={setQuery} placeholder="Поиск по названию вопроса" />
      {SECTIONS.map((sec) => {
        const items = QUESTIONS.filter((q) => q.section === sec.id && q.formulas.length && (!ql || lowerRu(q.short).includes(ql) || String(q.id) === ql));
        if (!items.length) return null;
        return (
          <section key={sec.id}>
            <h2 className="h2">{sec.title}</h2>
            <div className="panel" style={{ padding: '6px 14px' }}>
              <ul className="qlist">
                {items.map((q) => (
                  <li key={q.id} style={{ padding: '10px 0' }}>
                    <a href={`#/q/${q.id}`} style={{ color: 'var(--ink)', textDecoration: 'none', fontWeight: 600 }}>
                      № {q.id}. {q.short}
                    </a>
                    <div style={{ overflowX: 'auto' }}>
                      {q.formulas.map((f, k) => <MathBlock key={k} tex={f} />)}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        );
      })}
    </>
  );
}

type GItem = { term: string; qid: number; sentences: number[] };

export function Glossary() {
  const [query, setQuery] = useState('');
  const ql = lowerRu(query.trim());
  const items = (glossary as GItem[])
    .slice()
    .sort((a, b) => a.term.localeCompare(b.term, 'ru'))
    .filter((g) => !ql || lowerRu(g.term).includes(ql));
  return (
    <>
      <Top title="Термины" sub={`${glossary.length} определений из ответов`} />
      <Tabs cur="glossary" />
      <SearchBox value={query} onChange={setQuery} placeholder="Найти термин" />
      <div className="panel" style={{ marginTop: 14, padding: '4px 14px' }}>
        {items.length === 0 && <div className="empty"><b>Термин не найден</b>Попробуйте часть слова.</div>}
        <ul className="qlist">
          {items.map((g) => {
            const q = byId.get(g.qid)!;
            return (
              <li key={g.term} style={{ padding: '12px 0' }}>
                <b style={{ fontSize: 16 }}>{g.term}</b>
                <div style={{ marginTop: 4, lineHeight: 1.55 }}>
                  {g.sentences.map((k) => <span key={k}><Tex s={q.answer[k]} /> </span>)}
                </div>
                <a className="small" href={`#/q/${q.id}`}>Вопрос № {q.id}: {q.short}</a>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
