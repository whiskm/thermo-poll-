#!/usr/bin/env bash
# Проверка APK в эмуляторе: установка, запуск, текст главного экрана, ошибки JS.
set -u
APK=$(ls out-debug/*.apk | head -1)
adb install -r "$APK" || exit 1
adb logcat -c
adb shell am start -W -n io.github.whiskm.termoopros/.MainActivity
sleep 20
adb shell dumpsys activity activities | grep -m1 -E "mResumedActivity|topResumedActivity"
adb exec-out screencap -p > android-screen.png
adb shell uiautomator dump /sdcard/ui.xml > /dev/null 2>&1
adb pull /sdcard/ui.xml ui.xml > /dev/null 2>&1
echo "--- консоль приложения"
adb logcat -d | grep -E "Capacitor/Console|Capacitor:" | tail -40
if adb logcat -d | grep "Capacitor/Console" | grep -qiE "error|uncaught"; then
  echo "::error::В консоли приложения есть ошибки"
  exit 1
fi
if grep -q "вопросов на" ui.xml; then
  echo "Главный экран открылся: найден текст «вопросов на «знаю»»"
else
  echo "::error::На экране нет главной страницы ТермоОпроса"
  head -c 3000 ui.xml
  exit 1
fi
