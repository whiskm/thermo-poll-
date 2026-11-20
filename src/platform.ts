/** Где запущено приложение: браузер, APK (Capacitor) или Windows (Tauri). */
type CapWindow = Window & { Capacitor?: { isNativePlatform?: () => boolean } };

export function isCapacitor(): boolean {
  return Boolean((window as CapWindow).Capacitor?.isNativePlatform?.());
}

export function isTauri(): boolean {
  return '__TAURI_INTERNALS__' in window;
}

export function isNative(): boolean {
  return isCapacitor() || isTauri();
}
