## 1. Каркас форка

- [x] 1.1 Remote `upstream` → `https://github.com/anomalyco/opencode.git`, `git fetch upstream v1 dev`
- [x] 1.2 Создать ветки `blackbird/v1` от `upstream/v1` и `blackbird/v2` от `upstream/dev` (pushRemote → `origin`)
- [x] 1.3 `blackbird/v2` в корне клона, `git worktree add ../blackbird-v1 blackbird/v1`
- [x] 1.4 Проверить, что обе ветки ставятся и собираются без изменений (`bun install`, сборка CLI); зафиксировать команды сборки в README

## 2. Проверка ребрендинга (сначала, чтобы видеть красное)

- [x] 2.1 В `blackbird/v2` добавить `script/blackbird-check.sh` по D5: сборка CLI, запуск в изолированных HOME/XDG/TMPDIR, `find -iname '*opencode*'`, проверка `blackbird --help`, `BLACKBIRD_CONFIG_DIR` и отсутствия fetch каталога моделей
- [x] 2.2 Перенести тот же скрипт в `blackbird/v1` (с путём к бинарнику своей линии); убедиться, что на нетронутом коде обе проверки красные

## 3. Ребрендинг линии 2.x (`blackbird/v2`)

- [x] 3.1 `packages/util/src/global.ts`: `const app = "blackbird"`
- [x] 3.2 `packages/cli/package.json`: `bin` — только `blackbird`; имя команды в CLI/yargs и лого/заголовок TUI — `blackbird`
- [x] 3.3 Заменить литералы `".opencode"`, `"opencode.json"`, `"opencode.jsonc"` и имя БД/лога в runtime-коде (`packages/core`, `packages/util`, `packages/cli`, `packages/tui`) на blackbird-эквиваленты (найти через `grep -rnE '"\.opencode"|opencode\.jsonc?|opencode\.db'`)
- [x] 3.4 Отключить автоустановку `@opencode-ai/plugin` в config-каталогах
- [x] 3.5 Добавить env-shim (`BLACKBIRD_*` → `OPENCODE_*`) первым импортом entrypoint CLI
- [x] 3.6 Прогнать тесты апстрима для затронутых пакетов и починить тесты, которые проверяют старые имена путей

## 4. Провайдеры линии 2.x

- [x] 4.1 Определить generic-путь провайдера из конфига (`configured`/`dynamic`/`sdk-factory`) и проверить, что он работает сам по себе
- [x] 4.2 Убрать регистрацию встроенных провайдеров в `packages/core/src/plugin/provider.ts` и `internal.ts` построчно, не удаляя файлы
- [x] 4.3 Загрузчик `models-dev`: вернуть пустой каталог без fetch и без снапшота
- [x] 4.4 Отключить `auth login` и OAuth-флоу для удалённых провайдеров; при пустом списке провайдеров выводить подсказку про `blackbird.json`
- [x] 4.5 Ручная проверка: OpenAI-совместимый провайдер из `blackbird.json` отвечает в сессии; с `OPENAI_API_KEY` без конфига провайдеров нет
- [x] 4.6 `script/blackbird-check.sh` в `blackbird/v2` зелёный; сделать отдельные коммиты по темам (ребрендинг / env / провайдеры / проверка)

## 5. Линия 1.x (`blackbird/v1`)

- [x] 5.1 Повторить 3.1–3.6 с путями v1: `packages/core/src/global.ts`, `bin` в `packages/core/package.json`, литералы в `packages/core` и `packages/opencode`
- [x] 5.2 Повторить 4.1–4.5 с путями v1: `packages/core/src/plugin/provider.ts`, `packages/opencode/src/plugin/index.ts`, `packages/core/src/models-dev.ts`
- [x] 5.3 `script/blackbird-check.sh` в `blackbird/v1` зелёный; коммиты по темам

## 6. Тесты апстрима

- [x] 6.0.1 Тесты удалённой функциональности (провайдеры, каталог моделей, обновления) отключены: `.skip` по тесту, целые файлы — `pathIgnorePatterns` в bunfig
- [x] 6.0.2 Тесты и фикстуры, завязанные на имена opencode, переведены на blackbird (в 1.x — общий хелпер `test/fixture/fixture.ts`)
- [x] 6.0.3 Падения, которые есть и в чистом апстриме, не трогаем

## 7. Синхронизация с апстримом

- [x] 6.1 `script/blackbird-sync` в каждой ветке: fetch, merge апстрим-ветки текущей линии, при конфликте остановиться со списком файлов, иначе запустить `blackbird-check.sh`
- [x] 6.2 Проверить, что `git diff --name-status upstream/<branch>...blackbird/<line>` не содержит `D`/`R` в обеих линиях
- [x] 6.3 Закоммитить openspec в `blackbird/v2`, push обеих веток в `origin`
- [x] 6.4 Пробный sync на свежем апстриме для обеих линий; описать процедуру и разбор конфликтов в README
