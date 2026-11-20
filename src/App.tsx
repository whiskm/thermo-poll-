import { useEffect } from 'react';
import { AskHost, TabBar, ToastHost } from './components';
import { useRoute } from './router';
import { useStore } from './store';
import { isCapacitor } from './platform';
import { Learn } from './screens/Learn';
import { Session } from './screens/Session';
import { Exam } from './screens/Exam';
import { Formulas, Glossary, Questions } from './screens/Questions';
import { QuestionView } from './screens/QuestionView';
import { Stats } from './screens/Stats';
import { Settings } from './screens/Settings';

function useTheme() {
  const theme = useStore((s) => s.settings.theme);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0E1A23' : '#17324A');
      if (isCapacitor()) {
        // темный стиль Capacitor означает светлые значки строки состояния
        import('@capacitor/core')
          .then(({ SystemBars, SystemBarsStyle }) => SystemBars.setStyle({ style: dark ? SystemBarsStyle.Dark : SystemBarsStyle.Light }))
          .catch(() => undefined);
      }
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
}

function Screen() {
  const r = useRoute();
  const [head, arg] = r.parts;
  switch (head) {
    case 'learn':
      return arg ? <Session key={location.hash} mode={arg} /> : <Learn />;
    case 'exam':
      return <Exam />;
    case 'q':
      return arg ? <QuestionView key={arg} id={Number(arg)} /> : <Questions />;
    case 'formulas':
      return <Formulas />;
    case 'glossary':
      return <Glossary />;
    case 'stats':
      return <Stats />;
    case 'settings':
      return <Settings />;
    default:
      return <Learn />;
  }
}

export function App() {
  useTheme();
  return (
    <div className="app">
      <TabBar />
      <main className="view">
        <Screen />
      </main>
      <ToastHost />
      <AskHost />
    </div>
  );
}
