# Отчёт: два контрольных эксперимента по 404

## ЭКСПЕРИМЕНТ 1 — «чистый» тестовый роут

**Сделано:**
- Создан файл `app/__probe/page.tsx` с минимальным содержимым без сторонних импортов:
  ```tsx
  export default function Probe() {
    return <pre>PROBE_OK</pre>
  }
  ```

**Как проверить (после `npm install`):**
1. Запустить: `npm run dev`
2. Открыть в браузере или проверить: `curl -s http://127.0.0.1:3000/__probe`

**Интерпретация:**
- Если `/__probe` возвращает 200 и тело содержит `PROBE_OK` → Next dev видит App Router, 404 на других маршрутах создаётся кодом (layout/страницы).
- Если `/__probe` возвращает 404 → Next dev не видит `app/` или запущен не из корня/не тот путь к app.

**Примечание:** На момент отчёта `node_modules` отсутствовал (удалён при предыдущей диагностике), поэтому запуск dev и проверка `/__probe` не выполнялись. Выполните проверку после восстановления зависимостей.

---

## ЭКСПЕРИМЕНТ 2 — notFound() / redirect() в layout и page

**Поиск по коду (факты):**

1. **`notFound(` / `redirect(` / `NextResponse.rewrite|redirect`:**
   - В **`app/layout.tsx`** — **нет**.
   - В **`app/me/layout.tsx`** — **нет**.
   - В **`app/me/dashboard/page.tsx`** — **нет**.
   - Единственное вхождение в `app/`: **`app/me/planning/calendar/page.tsx`** — там вызывается `redirect('/me/checklist')`. Этот маршрут не в цепочке для `/` или `/me/dashboard`.

2. **`next.config.ts`:**
   - **basePath** и **pageExtensions** не заданы — сопоставление маршрутов не меняется.

3. **Layout’ы:**
   - `app/layout.tsx`: только `metadata`, `dynamic`, обёртка `<html><body>{children}</body></html>`, без auth/DB.
   - `app/me/layout.tsx`: импорт `Navigation`, обёртка с навигацией и `{children}`, без вызовов `notFound()`/`redirect()`.

**Вывод по эксперименту 2:** В цепочке для `/` и `/me/dashboard` ни один layout и ни одна страница не вызывают `notFound()` или `redirect()`. Конфиг не меняет basePath/pageExtensions. Значит, 404 не объясняется явными вызовами notFound/redirect в этом пути и не конфигом маршрутизации.

---

## Резюме

| Вопрос | Результат |
|--------|-----------|
| Открылся ли `/__probe`? | Не проверялось (нет `node_modules`). Инструкция для проверки — выше. |
| Есть ли notFound/redirect в layout/page для / и /me/dashboard? | **Нет.** Единственный redirect в app — в `app/me/planning/calendar/page.tsx`, не в цепочке этих маршрутов. |
| basePath/pageExtensions? | Не заданы. |

**Минимальный патч:** По текущим данным патч в коде (удаление notFound/redirect в layout/page) 404 не убирает — таких вызовов в цепочке `/` и `/me/dashboard` нет. Окончательный вывод по причине 404 зависит от результата проверки `/__probe` после восстановления `node_modules` и запуска dev.
