import { HeatBar, Legend, Top, countStatuses } from '../components';
import { QUESTIONS, SECTIONS, SECTION_SHORT, TOTAL } from '../content';
import { dayKey, useStore } from '../store';
import { dailyNorm, daysLeft, formatDuration, learned, streak } from '../stats';
import { plural } from '../text';

const WEEKS = 16;

export function Stats() {
  const s = useStore((x) => x);
  const counts = countStatuses(s.cards);
  const known = learned(s);
  const totalAnswers = Object.values(s.activity).reduce((a, d) => a + d.n, 0);
  const totalSec = Object.values(s.activity).reduce((a, d) => a + d.sec, 0);
  const st = streak(s.activity);
  const left = daysLeft(s.settings.examDate);
  const norm = dailyNorm(s);
  const passedN = s.exams.filter((e) => e.passed).length;

  // календарь: последние 18 недель, столбец = неделя с понедельника
  const today = new Date();
  const dow = (today.getDay() + 6) % 7;
  const start = new Date(today);
  start.setDate(today.getDate() - dow - (WEEKS - 1) * 7);
  const days: { key: string; n: number; future: boolean }[] = [];
  for (let k = 0; k < WEEKS * 7; k++) {
    const d = new Date(start);
    d.setDate(start.getDate() + k);
    const key = dayKey(d.getTime());
    days.push({ key, n: s.activity[key]?.n ?? 0, future: d > today });
  }
  const max = Math.max(1, ...days.map((d) => d.n));
  const level = (n: number) => (n === 0 ? 0 : Math.min(4, Math.ceil((n / max) * 4)));

  const hard = QUESTIONS.filter((q) => s.cards[q.id]?.lapses)
    .sort((a, b) => s.cards[b.id].lapses - s.cards[a.id].lapses)
    .slice(0, 5);

  return (
    <>
      <Top title="Статистика" />
      <section className="panel hero">
        <div className="hero-line">
          <b>{Math.round((known / TOTAL) * 100)}%</b>
          <span>выучено: {known} из {TOTAL}</span>
        </div>
        <HeatBar counts={counts} />
        <div style={{ marginTop: 12 }}><Legend /></div>
        <div className="facts">
          <div className="fact"><b>{totalAnswers}</b><span>оценок всего</span></div>
          <div className="fact"><b>{formatDuration(totalSec)}</b><span>в занятиях</span></div>
          <div className="fact"><b>{st}</b><span>{plural(st, 'день', 'дня', 'дней')} подряд</span></div>
        </div>
      </section>

      <h2 className="h2">План до зачета</h2>
      <div className="panel">
        {left === null ? (
          <p style={{ margin: 0 }}>
            Дата зачета не задана. <a href="#/settings">Указать дату</a>, и приложение посчитает норму на каждый день.
          </p>
        ) : (
          <>
            <p style={{ margin: 0 }}>
              До зачета {left} {plural(left, 'день', 'дня', 'дней')}. Осталось выучить {TOTAL - known} {plural(TOTAL - known, 'вопрос', 'вопроса', 'вопросов')}.
            </p>
            <p className="muted" style={{ margin: '6px 0 0' }}>Норма на сегодня: {norm} {plural(norm, 'ответ', 'ответа', 'ответов')} в любых режимах.</p>
          </>
        )}
      </div>

      <h2 className="h2">По разделам</h2>
      <div className="panel bars">
        {SECTIONS.map((sec) => {
          const ids = QUESTIONS.filter((q) => q.section === sec.id).map((q) => q.id);
          const c = countStatuses(s.cards, ids);
          return (
            <div key={sec.id} className="bar-row">
              <span>{SECTION_SHORT[sec.id]}</span>
              <HeatBar counts={c} />
              <b>{Math.round((c.good / ids.length) * 100)}%</b>
            </div>
          );
        })}
      </div>

      <h2 className="h2">Занятия по дням</h2>
      <div className="panel">
        <div className="cal" aria-label={`Активность за ${WEEKS} недель`}>
          {days.map((d) => (
            <i key={d.key} data-l={level(d.n)} title={`${d.key}: ${d.n}`} style={d.future ? { visibility: 'hidden' } : undefined} />
          ))}
        </div>
        <p className="small muted" style={{ margin: '8px 0 0' }}>Чем темнее клетка, тем больше ответов в этот день. Столбец равен неделе.</p>
      </div>

      {hard.length > 0 && (
        <>
          <h2 className="h2">Чаще всего забываются</h2>
          <div className="panel" style={{ padding: '4px 12px' }}>
            <ul className="qlist">
              {hard.map((q) => (
                <li key={q.id}>
                  <a className="qrow" href={`#/q/${q.id}`}>
                    <span className="id">{q.id}</span>
                    <span className="t">{q.short}</span>
                    <span className="small muted">{s.cards[q.id].lapses} раз</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      <h2 className="h2">Пробные зачеты</h2>
      <div className="panel">
        {s.exams.length === 0 ? (
          <p style={{ margin: 0 }}>Попыток пока нет. <a href="#/exam">Вытянуть первый билет</a></p>
        ) : (
          <>
            <p style={{ margin: '0 0 8px' }}>Сдано {passedN} из {s.exams.length}.</p>
            <ul className="exams">
              {s.exams.slice(0, 20).map((e) => (
                <li key={e.id}>
                  <span>{new Date(e.at).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}{e.strict ? ', строгий' : ''}</span>
                  <span className={`verdict ${e.passed ? 'ok' : 'bad'}`} style={{ fontSize: 13, padding: '2px 10px' }}>{e.passed ? 'зачет' : 'незачет'}</span>
                  <span className="small muted" style={{ gridColumn: '1 / -1' }}>
                    {e.qids.map((id, k) => `№ ${id} ${['не знаю', 'почти', 'знаю'][e.grades[k]]}`).join('; ')}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </>
  );
}
