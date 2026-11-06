## 1. Brand и режим совместимости (2.x)

- [x] 1.1 `packages/util/src/brand.ts`: `compat`, `name`
- [x] 1.2 Заменить литералы `blackbird` из `blackbird-fork` на `Brand.name` (global, logging, database-path, discovery, config, git, project, plan, mcp add, updater policy, tui config-directories и plugin discovery)
- [x] 1.3 env-shim: разбор `--opencode-compatible[=dir]`, удаление из argv, `OPENCODE_CONFIG_DIR`
- [x] 1.4 Провайдеры и каталог моделей условно по `Brand.compat`

## 2. Импорт (2.x)

- [x] 2.1 `packages/cli/src/blackbird-import.ts`: глобальный режим, режим пути, переименование, бэкапы, пропуски, отчёт
- [x] 2.2 База: проверка миграций и мажорной версии, `VACUUM INTO`
- [x] 2.3 Подключить вторым импортом entrypoint, разбор `--opencode-import [path]` в shim
- [x] 2.4 Юнит-тест импорта

## 3. Проверка 2.x

- [x] 3.1 `blackbird-check.sh`: проход с `--opencode-compatible`
- [ ] 3.2 Typecheck, тесты, check; ручной прогон импорта на копии реальных данных opencode
- [ ] 3.3 Коммиты по темам

## 4. Линия 1.x

- [x] 4.1 Перенести 1.1–1.4 на пути 1.x (`packages/core/src/brand.ts`, `packages/opencode/src/...`)
- [x] 4.2 Перенести импорт (2.1–2.4) с миграциями 1.x
- [ ] 4.3 Проверка как в 3.x, коммиты

## 5. Завершение

- [x] 5.1 `BLACKBIRD.md`: импорт и режим совместимости
- [ ] 5.2 Push веток
