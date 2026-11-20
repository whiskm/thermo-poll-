#!/usr/bin/env bash
# Проверка APK в эмуляторе: установка, запуск, главный экран, вопрос со схемами, ошибки JS.
set -u
APK=$(ls out-debug/*.apk | head -1)
adb install -r "$APK" || exit 1
adb logcat -c
adb shell am start -W -n io.github.whiskm.termoopros/.MainActivity
sleep 15
adb exec-out screencap -p > android-screen.png
PID=$(adb shell pidof io.github.whiskm.termoopros | tr -d '\r')
adb forward tcp:9222 "localabstract:webview_devtools_remote_$PID" || exit 1

HOME_TEXT=$(node scripts/webview-eval.mjs "document.querySelector('.hero-line')?.innerText.replace(/\\s+/g,' ') + ' | клеток: ' + document.querySelectorAll('.cell').length")
echo "Главный экран: $HOME_TEXT"
echo "$HOME_TEXT" | grep -q "из 69 вопросов" || { echo "::error::Главный экран не отрисовался"; exit 1; }
echo "$HOME_TEXT" | grep -q "клеток: 69" || { echo "::error::Термокарта неполная"; exit 1; }

Q52=$(node scripts/webview-eval.mjs "(async () => { location.hash = '#/q/52'; await new Promise(r => setTimeout(r, 1500)); return document.querySelector('.top h1')?.innerText.replace(/\\s+/g,' ') + ' | схем: ' + document.querySelectorAll('.diagram svg').length + ' | формул: ' + document.querySelectorAll('.katex').length; })()")
echo "Вопрос 52: $Q52"
echo "$Q52" | grep -q "схем: 3" || { echo "::error::Схемы вопроса 52 не отрисовались"; exit 1; }

echo "--- консоль приложения"
adb logcat -d | grep "Capacitor/Console" | tail -20
if adb logcat -d | grep "Capacitor/Console" | grep -qiE "uncaught|TypeError|ReferenceError"; then
  echo "::error::В консоли приложения есть ошибки JavaScript"
  exit 1
fi
echo "APK работает"
