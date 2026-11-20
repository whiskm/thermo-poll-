import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.github.whiskm.termoopros',
  appName: 'ТермоОпрос',
  webDir: 'dist',
  android: {
    backgroundColor: '#EDF2F0',
  },
  plugins: {
    // Отступы под строку состояния задает сам Android, CSS-переменные не внедряются:
    // режим css в Capacitor 8 пишет ошибку в консоль при старте страницы.
    SystemBars: { insetsHandling: 'native' },
  },
};

export default config;
