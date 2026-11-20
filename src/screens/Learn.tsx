import { Settings as Gear, Layers, PenLine, ListOrdered, HelpCircle, TextCursorInput, Flame, ChevronRight } from 'lucide-react';
import { HeatBar, Legend, ThermoMap, Top, countStatuses } from '../components';
import { TOTAL } from '../content';
import { dueCount } from '../learn';
import { dayKey, useStore } from '../store';
import { daysLeft, dailyNorm, learned, streak } from '../stats';
import { plural } from '../text';

export const MODES = [
  { id: 'cards', icon: Layers, title: 'Карточки', text: 'Вопрос, переворот, самооценка. Слабые вопросы возвращаются чаще.' },
  { id: 'cloze', icon: TextCursorInput, title: 'Пропуски', text: 'Вставьте пропущенные термины и формулы в текст ответа.' },
  { id: 'quiz', icon: HelpCircle, title: 'Угадай вопрос', text: 'Найдите вопрос по ответу или ответ по вопросу из 4 вариантов.' },
  { id: 'order', icon: ListOrdered, title: 'Собери ответ', text: 'Расставьте предложения ответа в правильном порядке.' },
  { id: 'recall', icon: PenLine, title: 'Свой ответ', text: 'Напишите ответ сами, приложение проверит ключевые термины.' },
] as const;

export function Learn() {
  const s = useStore((x) => x);
  const counts = countStatuses(s.cards);
  const known = learned(s);
  const due = dueCount(s);
  const fresh = counts.new;
  const today = s.activity[dayKey()]?.n ?? 0;
  const norm = dailyNorm(s);
  const left = daysLeft(s.settings.examDate);
  const st = streak(s.activity);

  let cta = { href: '#/learn/cards?src=due', label: '' };
  if (due > 0) cta.label = `Повторить ${due} ${plural(due, 'вопрос', 'вопроса', 'вопросов')}`;
  else if (fresh > 0) cta.label = fresh === TOTAL ? 'Начать с первых вопросов' : `Взять новые вопросы (осталось ${fresh})`;
  else cta = { href: '#/exam', label: 'Повторять нечего. Пройти пробный зачет' };

  return (
    <>
      <Top title="ТермоОпрос" sub="Техническая термодинамика, часть I"
        right={<a className="icon-btn" href="#/settings" aria-label="Настройки"><Gear size={22} /></a>} />

      <section className="panel hero" aria-label="Прогресс">
        <div className="hero-line">
          <b>{known}</b>
          <span>из {TOTAL} вопросов на «знаю»</span>
        </div>
        <HeatBar counts={counts} />
        <div className="facts">
          <div className="fact">
            <b>{today}<span className="muted" style={{ fontSize: 14, fontWeight: 500 }}> / {norm}</span></b>
            <span>ответов сегодня</span>
          </div>
          <div className="fact">
            <b>{st}</b>
            <span>{plural(st, 'день', 'дня', 'дней')} подряд</span>
          </div>
          <a className="fact" href="#/settings" style={{ color: 'inherit', textDecoration: 'none' }}>
            <b>{left ?? '?'}</b>
            <span>{left === null ? 'дата зачета не задана' : `${plural(left, 'день', 'дня', 'дней')} до зачета`}</span>
          </a>
        </div>
        <a className="btn big block" href={cta.href} style={{ marginTop: 14 }}>
          {cta.label}
        </a>
      </section>

      <h2 className="h2">Термокарта</h2>
      <section className="panel" aria-label="Термокарта вопросов">
        <ThermoMap />
        <div style={{ marginTop: 14 }}>
          <Legend />
        </div>
      </section>

      <h2 className="h2">Режимы</h2>
      <div className="modes">
        {MODES.map((m) => (
          <a key={m.id} className="mode" href={`#/learn/${m.id}`}>
            <span className="ico"><m.icon size={22} /></span>
            <span><b>{m.title}</b><small>{m.text}</small></span>
            <ChevronRight size={18} />
          </a>
        ))}
        <a className="mode" href="#/learn/cards?src=weak">
          <span className="ico" style={{ color: 'var(--cold)' }}><Flame size={22} /></span>
          <span>
            <b>Работа над ошибками</b>
            <small>Карточки по вопросам с оценкой «не знаю» и «почти»: {counts.bad + counts.mid}.</small>
          </span>
          <ChevronRight size={18} />
        </a>
      </div>
    </>
  );
}
