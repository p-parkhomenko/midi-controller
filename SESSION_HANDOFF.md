# Session Handoff

Передача контекста между сессиями. Последняя запись — сверху.

---

## 2026-04-18 → next session (Phase 2 start)

### Что сделали сегодня

1. **Фикс задержки фейдера (LOG #020).** Входящее MIDI-эхо перезаписывало `data.value` во время драга — появлялся визуальный джиттер. Решение: `FaderElement.isActive()` + guard первой строкой в `applyInput`. Принцип зафиксирован как "Local gesture wins" в Принципе 6 BUILDING_PRINCIPLES.md — распространяется на knob/XY-pad в Phase 3.

2. **UX-дизайн Phase 2 (брейнсторм).** Проработали все 4 развилки:
   - **Edit/Play:** Segmented Control внизу-слева, Liquid Glass, всегда видим, «Play» (не «Session»).
   - **Inspector:** Drawer справа + direct manipulation на островке (drag тело = перемещение, drag угол = resize).
   - **Сетка:** 22px grid (= min touch target / 2 = 44pt Apple HIG), снэп к сетке.
   - **Добавление:** «+» рядом с сегментед контролом → Drawer с палитрой → первая свободная ячейка.
   - Все решения — в [BUILDING_PRINCIPLES.md](BUILDING_PRINCIPLES.md) и ниже.

3. **Phase 2 реализована.** Полный рефакторинг архитектуры:
   - `core/layout.js` — flat elements model, `ELEMENT_DEFS`, `addElement/removeElement/updateElement/duplicateElement`, localStorage persistence.
   - `ui/canvas.js` — island-based rendering (absolute positioning).
   - `ui/editMode.js` — overlay, corner handles, drag (150ms / 12px), resize с `preserveAspectRatio`.
   - `ui/drawer.js` — Drawer: редактор элемента + палитра.
   - `ui/toast.js` — Undo toast.
   - `index.html` — segmented control, canvas zoom-focus, весь wiring.
   - `design-system/elements.css` — island, overlay, handles, drawer, segmented, toast.

### Ключевые решения Phase 2 (зафиксировать при тестировании)

**Island-модель:**
- Пользователь манипулирует островком (прямоугольник на 22px сетке).
- Элемент вписан внутрь с padding из `ELEMENT_DEFS[type]`.
- `preserveAspectRatio: true` → вписывается по наименьшей стороне (fader, knob).
- `preserveAspectRatio: false` → растягивается на весь остров (button).

**Жесты Edit mode:**
- Short tap на тело → открыть Drawer + zoom-focus на элемент.
- 150ms long press ИЛИ >12px движение → начать drag (перемещение).
- Drag угловых хэндлов → resize.
- Tap по пустому канвасу → закрыть Drawer.

**Delete:** без confirm, Undo toast 4 секунды (низ-центр).

**Save:** автосейв localStorage после каждого изменения.

### Текущее состояние проекта

Phase 2 реализована, **не тестирована**. Нужна ручная проверка:

1. Play mode: MIDI работает как в Phase 1, edit-chrome не видно.
2. Edit mode: добавить Button → Drawer → ввести label/Note → Play → кнопка шлёт MIDI.
3. Переместить island (long press → drag).
4. Resize corner handle (fader сохраняет пропорции, кнопка тянется свободно).
5. Delete + Undo toast.
6. Duplicate.
7. Перезагрузить страницу → layout восстановлен из localStorage.
8. Canvas zoom-focus при открытии Drawer + возврат при закрытии.

Если при тестировании найдутся баги — начать сессию с их фикса.

### Что делаем дальше

**Ближайшее:** пройти по чек-листу выше на iPad с Ableton.

**После стабилизации Phase 2 — Phase 3: новые типы элементов.**
- Knob (CC, `preserveAspectRatio: true`, aspect 1:1)
- XY-pad (CC X + CC Y, `preserveAspectRatio: false` или настраиваемый)
- Возможно: Trigger-pad с velocity

**Открытые вопросы (backlog):**
- Канвас больше экрана + навигация (связан с адаптивностью под разные экраны)
- Multi-select
- Min/Max range, invert, velocity — Phase 3+
- Многостраничность (страница = MIDI канал)

### Ключевые файлы для быстрого входа

- [BUILDING_PRINCIPLES.md](BUILDING_PRINCIPLES.md) — что строим и почему, 6 принципов + "Local gesture wins"
- [ARCHITECTURE.md](ARCHITECTURE.md) — слои, MIDI-адресация, структура файлов
- [LOG.md](LOG.md) — хронология решений, открытые вопросы
- [core/layout.js](core/layout.js) — data model, ELEMENT_DEFS, persistence
- [ui/canvas.js](ui/canvas.js), [ui/editMode.js](ui/editMode.js), [ui/drawer.js](ui/drawer.js) — ядро Phase 2

### Как запустить локально

`.claude/launch.json` настроен. В Claude Code: preview_start → "Static Server" (порт 3000, `npx serve`).

---

## 2026-04-18 → next session (Phase 1 final)

### Что сделали сегодня

1. **Двусторонний MIDI-транспорт** (закрыт LOG #018). Transport теперь слушает входной порт, входящие CC/Note маппятся на элементы через routing table `(channel, cc|note) → applyInput`. Визуал зеркалит состояние Ableton (клик мышью, автоматизация, envelope follower) без эха наружу. Требует Remote=on на MIDI-порту в Ableton Preferences.
2. **Реверт toggle-кнопок на Note On/Off** (закрыт LOG #019, пересмотрен #016). С появлением фидбека проблема рассинхрона решается на уровне транспорта, CC-абсолют больше не нужен как страховка. Все кнопки теперь общаются нотами; протокол зависит от типа элемента (continuous → CC, button → Note), а не от режима кнопки.
3. **Документация синхронизирована:** ARCHITECTURE.md (таблица MIDI-адресации), BUILDING_PRINCIPLES.md (Принцип 6 переписан вокруг одного механизма — двустороннего транспорта), LOG.md (#018, #019).
4. **PR #1 замержен.** main актуален.

---
