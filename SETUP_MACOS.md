# Установка окружения на macOS (better-sqlite3 и probe)

## 1. Почему падает `npm install` (better-sqlite3)

`better-sqlite3` — нативный модуль: при установке либо скачивается prebuild (бинарник под твою платформу), либо собирается через `node-gyp` (нужны Xcode Command Line Tools и Python).

- **Ошибка вида** `No receipt for 'com.apple.pkg.CLTools_Executables'` / `GypError: Error 1 running xcodebuild` — на машине не установлены или не выбраны Xcode Command Line Tools.

## 2. Команды для macOS (минимальный фикс)

Выполни в терминале по порядку.

### 2.1. Xcode Command Line Tools (обязательно для сборки нативных модулей)

```bash
# Проверить, установлены ли CLT
xcode-select -p

# Если команда выше выдаёт ошибку — установить CLT (откроется окно установки)
xcode-select --install
```

После установки снова выполни `xcode-select -p` — должен вывести путь, например `/Library/Developer/CommandLineTools`.

### 2.2. (Опционально) Python для node-gyp

Обычно достаточно системного Python. Если node-gyp ругается на Python:

```bash
# Указать npm использовать текущий python3
npm config set python "$(which python3)"
```

### 2.3. Установка зависимостей проекта

```bash
cd /path/to/twinworks
npm install
```

Если `npm install` всё равно падает на better-sqlite3:

- Убедись, что после `xcode-select --install` установка CLT полностью завершилась.
- Попробуй очистить кэш и переустановить:  
  `rm -rf node_modules .next && npm cache clean --force && npm install`

## 3. Запуск и проверка /__probe

```bash
npm run dev
```

В другом терминале:

```bash
curl -sS http://127.0.0.1:3000/__probe
# Ожидается: PROBE_OK
```

Маршрут `/__probe` отдаёт тот же ответ, что и `/api/probe` (через rewrite в `next.config.ts`). Прямая проверка API:

```bash
curl -sS http://127.0.0.1:3000/api/probe
# Ожидается: PROBE_OK
```

## 4. Что сделано в проекте (без переписывания приложения)

- **better-sqlite3** не заменялся: используется как есть (dependencies + API routes + Prisma adapter).
- Добавлен API health-check: `app/api/probe/route.ts` — GET возвращает `PROBE_OK`.
- Добавлен rewrite в `next.config.ts`: запрос к `/__probe` обрабатывается как `/api/probe`, в ответе — `PROBE_OK`.
- Страница `app/probe/page.tsx` оставлена для маршрута `/probe` (опционально).
- Папка `app/__probe/` удалена: в App Router папки с префиксом `_` не участвуют в маршрутизации, поэтому `/__probe` реализован через rewrite на `/api/probe`.

Если после установки CLT и `npm install` dev-сервер запускается, но часть маршрутов (в т.ч. `/api/probe`) отдают 404 — это может быть отдельная проблема окружения (например, лимиты файловых дескрипторов или кэш). В этом случае попробуй `rm -rf .next && npm run dev` и снова проверить `curl http://127.0.0.1:3000/__probe`.
