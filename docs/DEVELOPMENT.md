# Разработка

## Запуск

```bash
npm install
npm run dev      # разработка, http://localhost:5173
npm test         # тесты логики (vitest)
npm run build    # сборка сайта в dist/
```

Нужен Node.js 22 (см. `.nvmrc`).

## Устройство проекта

| Путь | Что там |
|---|---|
| `src/` | Приложение на React и TypeScript |
| `src/modes/` | Режимы: карточки, пропуски, угадай вопрос, собери ответ, свой ответ |
| `src/screens/` | Экраны: главная, зачет, справочник, статистика, настройки |
| `content/questions.json` | 69 вопросов, ответы, формулы, термины, ссылки на схемы (поля описаны в `content/README.md`) |
| `content/glossary.json` | 62 термина со ссылками на предложения ответов |
| `content/diagrams/` | 50 схем в SVG |
| `scripts/diagrams.py` | Генератор схем: `pip install iapws && python3 scripts/diagrams.py` |
| `android/` | Проект Capacitor для APK |
| `src-tauri/` | Проект Tauri для Windows |
| `tests/` | Тесты логики |

Прогресс хранится в IndexedDB браузера, сервера нет.

## Сайт

Сайт собирается на Cloudflare из ветки `main` командой `npm run build`, папка `dist`. Подключение описано в [cloudflare.md](cloudflare.md).

## APK и Windows

- APK: `npm run build && npx cap sync android && cd android && ./gradlew assembleRelease`. Нужны JDK 21 и Android SDK.
- Windows: `npx tauri build` на Windows. Нужен Rust. Установщик появится в `src-tauri/target/release/bundle/nsis/`.

## Выпуск версии

1. Поднимите `version` в `package.json`, например `1.0.0` → `1.1.0`.
2. Слейте изменения в `main`.
3. GitHub Actions (`.github/workflows/build.yml`) прогонит тесты, соберет APK и установщик и проверит их: APK запускается в эмуляторе Android 14, установщик ставится и запускается на Windows.
4. Если релиза `v<версия>` еще нет, он создается с файлами `TermoOpros-<версия>.apk` и `TermoOpros-<версия>-setup.exe`.

Версия APK считается из `package.json`: `1.2.3` дает versionCode `10203`.

## Подпись APK

APK подписывается ключом из секретов репозитория (Settings → Secrets and variables → Actions):

| Секрет | Значение |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | Файл ключа в base64 |
| `ANDROID_KEYSTORE_PASSWORD` | Пароль хранилища |
| `ANDROID_KEY_ALIAS` | `termoopros` |
| `ANDROID_KEY_PASSWORD` | Пароль ключа |

Без секретов сборка в `main` останавливается. Ключ нельзя менять: APK с другим ключом не встанет поверх старой версии.
