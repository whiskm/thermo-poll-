import { useEffect, useState, type ReactNode } from 'react';
import katex from 'katex';
import { ArrowLeft, BarChart3, BookOpen, ClipboardCheck, GraduationCap, X } from 'lucide-react';
import { QUESTIONS, SECTIONS, SECTION_SHORT, diagramSvg, type Diagram, type Question } from './content';
import { go, useRoute } from './router';
import { STATUS_LABEL, statusOf, type Grade, type Status } from './srs';
import { useStore } from './store';
import { splitMath } from './text';

const cache = new Map<string, string>();
function renderTex(tex: string, display: boolean): string {
  const key = (display ? 'D' : 'I') + tex;
  let html = cache.get(key);
  if (html === undefined) {
    try {
      html = katex.renderToString(tex, { displayMode: display, throwOnError: false, strict: 'ignore', output: 'html' });
    } catch {
      html = tex;
    }
    cache.set(key, html);
  }
  return html;
}

/** Прокрутка наверх при смене вопроса или этапа. */
export function useScrollTop(dep: unknown) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [dep]);
}

/** Текст с формулами между знаками $. */
export function Tex({ s }: { s: string }) {
  return (
    <>
      {splitMath(s).map((p, i) =>
        p.kind === 'math' ? <span key={i} dangerouslySetInnerHTML={{ __html: renderTex(p.v, false) }} /> : <span key={i}>{p.v}</span>,
      )}
    </>
  );
}

export function MathInline({ tex }: { tex: string }) {
  return <span dangerouslySetInnerHTML={{ __html: renderTex(tex, false) }} />;
}

export function MathBlock({ tex }: { tex: string }) {
  return <div dangerouslySetInnerHTML={{ __html: renderTex(tex, true) }} />;
}

export function DiagramView({ d }: { d: Diagram }) {
  const [zoom, setZoom] = useState(false);
  const svg = diagramSvg(d.file);
  return (
    <>
      <figure className="diagram" onClick={() => setZoom(true)} role="button" tabIndex={0} aria-label={`Увеличить: ${d.caption}`}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setZoom(true)}>
        <div dangerouslySetInnerHTML={{ __html: svg }} />
        <figcaption>{d.caption}</figcaption>
      </figure>
      {zoom && (
        <Overlay onClose={() => setZoom(false)}>
          <div className="zoom" onClick={() => setZoom(false)}>
            <div dangerouslySetInnerHTML={{ __html: svg }} />
            <p className="small muted center">{d.caption}</p>
          </div>
        </Overlay>
      )}
    </>
  );
}

export function Overlay({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      {children}
    </div>
  );
}

export function Sheet({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <Overlay onClose={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="row" style={{ marginBottom: 8 }}>
          <b style={{ flex: 1, fontSize: 18 }}>{title}</b>
          <button className="icon-btn" onClick={onClose} aria-label="Закрыть">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </Overlay>
  );
}

type Ask = { text: string; ok: string; resolve: (v: boolean) => void };
let askSet: ((a: Ask | null) => void) | null = null;
/** Подтверждение внутри приложения: системные окна confirm() работают не во всех оболочках. */
export function ask(text: string, ok: string): Promise<boolean> {
  return new Promise((resolve) => (askSet ? askSet({ text, ok, resolve }) : resolve(false)));
}
export function AskHost() {
  const [a, setA] = useState<Ask | null>(null);
  useEffect(() => {
    askSet = setA;
    return () => {
      askSet = null;
    };
  }, []);
  if (!a) return null;
  const done = (v: boolean) => {
    a.resolve(v);
    setA(null);
  };
  return (
    <Sheet title="Подтвердите" onClose={() => done(false)}>
      <p style={{ marginTop: 0 }}>{a.text}</p>
      <div className="row wrap">
        <button className="btn danger" onClick={() => done(true)}>{a.ok}</button>
        <button className="btn ghost" onClick={() => done(false)}>Отмена</button>
      </div>
    </Sheet>
  );
}

let toastSet: ((s: string) => void) | null = null;
export function toast(s: string) {
  toastSet?.(s);
}
export function ToastHost() {
  const [msg, setMsg] = useState('');
  useEffect(() => {
    toastSet = setMsg;
    return () => {
      toastSet = null;
    };
  }, []);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(''), 2600);
    return () => clearTimeout(t);
  }, [msg]);
  return msg ? (
    <div className="toast" role="status">
      {msg}
    </div>
  ) : null;
}

export function Top({ title, sub, backTo, right }: { title: ReactNode; sub?: ReactNode; backTo?: string; right?: ReactNode }) {
  return (
    <header className="top">
      {backTo && (
        <button className="icon-btn" onClick={() => go(backTo)} aria-label="Назад">
          <ArrowLeft size={22} />
        </button>
      )}
      <h1>
        {title}
        {sub && <span className="sub">{sub}</span>}
      </h1>
      {right}
    </header>
  );
}

const TABS = [
  { to: '/learn', label: 'Учить', icon: GraduationCap, match: ['learn', 'settings'] },
  { to: '/exam', label: 'Зачет', icon: ClipboardCheck, match: ['exam'] },
  { to: '/q', label: 'Вопросы', icon: BookOpen, match: ['q', 'formulas', 'glossary'] },
  { to: '/stats', label: 'Статистика', icon: BarChart3, match: ['stats'] },
];

export function TabBar() {
  const r = useRoute();
  const head = r.parts[0] ?? 'learn';
  return (
    <nav className="tabbar" aria-label="Разделы">
      <div className="brand">
        <img src="./icon.svg" alt="" />
        ТермоОпрос
      </div>
      {TABS.map((t) => (
        <a key={t.to} href={'#' + t.to} aria-current={t.match.includes(head) ? 'page' : undefined}>
          <t.icon size={22} />
          {t.label}
        </a>
      ))}
    </nav>
  );
}

export function Chips<T extends string | number>({ options, value, onChange, multi, scroll }: {
  options: { v: T; label: string }[];
  value: T[];
  onChange: (v: T[]) => void;
  multi?: boolean;
  scroll?: boolean;
}) {
  return (
    <div className={scroll ? 'chips scroll' : 'chips'}>
      {options.map((o) => {
        const on = value.includes(o.v);
        return (
          <button key={String(o.v)} className="chip" aria-pressed={on}
            onClick={() => onChange(multi ? (on ? value.filter((x) => x !== o.v) : [...value, o.v]) : [o.v])}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Seg<T extends string | number | boolean>({ options, value, onChange, label }: {
  options: { v: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.v)} aria-pressed={o.v === value} onClick={() => onChange(o.v)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const SECTION_OPTIONS = SECTIONS.map((s) => ({ v: s.id, label: SECTION_SHORT[s.id] }));

export function SectionPicker({ value, onChange, scroll }: { value: string[]; onChange: (v: string[]) => void; scroll?: boolean }) {
  return (
    <div className={scroll ? 'chips scroll' : 'chips'}>
      <button className="chip" aria-pressed={value.length === 0} onClick={() => onChange([])}>
        Все разделы
      </button>
      {SECTION_OPTIONS.map((o) => {
        const on = value.includes(o.v);
        return (
          <button key={o.v} className="chip" aria-pressed={on} onClick={() => onChange(on ? value.filter((x) => x !== o.v) : [...value, o.v])}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Термокарта: 69 клеток, цвет показывает, насколько вопрос выучен. */
export function ThermoMap() {
  const cards = useStore((s) => s.cards);
  return (
    <div className="thermo">
      {SECTIONS.map((sec) => (
        <div key={sec.id} className="thermo-sec">
          <h3>{SECTION_SHORT[sec.id]}</h3>
          <div className="cells">
            {QUESTIONS.filter((q) => q.section === sec.id).map((q) => {
              const st = statusOf(cards[q.id]);
              return (
                <a key={q.id} href={`#/q/${q.id}`} className={`cell st-${st}`} title={`${q.id}. ${q.short}: ${STATUS_LABEL[st]}`}>
                  {q.id}
                </a>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function Legend() {
  return (
    <div className="legend">
      {(['good', 'mid', 'bad', 'new'] as Status[]).map((s) => (
        <span key={s}>
          <i className={`dot st-${s}`} />
          {STATUS_LABEL[s]}
        </span>
      ))}
    </div>
  );
}

export function HeatBar({ counts }: { counts: Record<Status, number> }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  return (
    <div className="heatbar" aria-hidden="true">
      {(['good', 'mid', 'bad', 'new'] as Status[]).map((s) =>
        counts[s] ? <i key={s} className={`st-${s}`} style={{ width: `${(counts[s] / total) * 100}%` }} /> : null,
      )}
    </div>
  );
}

export function countStatuses(cards: Record<number, unknown>, ids: number[] = QUESTIONS.map((q) => q.id)) {
  const c: Record<Status, number> = { new: 0, bad: 0, mid: 0, good: 0 };
  for (const id of ids) c[statusOf((cards as Record<number, Parameters<typeof statusOf>[0]>)[id])]++;
  return c;
}

/** Кнопки самооценки. Клавиши 1, 2, 3 на компьютере. */
export function GradeBar({ onGrade }: { onGrade: (g: Grade) => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'TEXTAREA' || (e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === '1') onGrade(0);
      if (e.key === '2') onGrade(1);
      if (e.key === '3') onGrade(2);
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onGrade]);
  return (
    <div className="grades">
      <button className="grade st-bad" onClick={() => onGrade(0)}>Не знаю<kbd>1</kbd></button>
      <button className="grade st-mid" onClick={() => onGrade(1)}>Почти<kbd>2</kbd></button>
      <button className="grade st-good" onClick={() => onGrade(2)}>Знаю<kbd>3</kbd></button>
    </div>
  );
}

/** Полный ответ: предложения, формулы, схемы, заметка. */
export function AnswerView({ q, answer, note, edited }: { q: Question; answer: string[]; note?: string; edited?: boolean }) {
  return (
    <div>
      {edited && <div className="edited-mark">Ваша формулировка</div>}
      <ol className="answer">
        {answer.map((s, i) => (
          <li key={i}>
            <Tex s={s} />
          </li>
        ))}
      </ol>
      {q.formulas.length > 0 && (
        <div className="formulas">
          {q.formulas.map((f, i) => (
            <MathBlock key={i} tex={f} />
          ))}
        </div>
      )}
      {q.diagrams.length > 0 && (
        <div className="diagrams">
          {q.diagrams.map((d) => (
            <DiagramView key={d.file} d={d} />
          ))}
        </div>
      )}
      {note && <div className="note-box">{note}</div>}
    </div>
  );
}

export function QHead({ q }: { q: Question }) {
  return (
    <div className="qnum">
      <b>№ {q.id}</b>
      <span>{SECTION_SHORT[q.section]}</span>
    </div>
  );
}

export function Progress({ value }: { value: number }) {
  return (
    <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}>
      <i style={{ width: `${Math.min(100, value * 100)}%` }} />
    </div>
  );
}
