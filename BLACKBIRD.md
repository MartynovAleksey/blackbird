# blackbird

Кодинг-агент на базе [opencode](https://github.com/anomalyco/opencode). Отличия от апстрима:

- на машине пользователя всё называется `blackbird`: бинарник, `~/.config|.local/share|.cache|.local/state/blackbird`, `.blackbird/` в проекте, `blackbird.json[c]`, БД и логи; переменные `BLACKBIRD_*` переопределяют `OPENCODE_*`;
- нет встроенных провайдеров и каталога моделей (models.dev): модели берутся только из `blackbird.json`;
- проверка и установка обновлений из релизов opencode отключены.

Исходники апстрима (пакеты `@opencode-ai/*`, `packages/opencode` и т. п.) не переименованы — так обновления мержатся дёшево.

## Линии

| Ветка | Основа (тег апстрима) | Где лежит | Сборка (из корня) | Бинарник |
|---|---|---|---|---|
| `blackbird/v2` | `v2.2.5` | `blackbird/` | `cd packages/cli && bun run script/build.ts --single --skip-install --skip-web-ui` | `packages/cli/dist/cli-<os>-<arch>/bin/blackbird` |
| `blackbird/v1` | `v1.19.5` | `blackbird-v1/` (worktree) | `cd packages/opencode && bun run script/build.ts --single --skip-install` | `packages/opencode/dist/opencode-<os>-<arch>/bin/blackbird` |

Нужен bun версии из `packageManager` в корневом `package.json`.

## Сборка релиза в Docker

Все платформы (darwin, linux, windows × arm64, x64) собираются в контейнере; на хосте нужен только Docker. Образ содержит только инструменты, исходники монтируются только для чтения, архивы и `SHA256SUMS` в формате релизов появляются в `./release`.

```bash
docker build --platform linux/arm64 -t blackbird-builder - < script/blackbird-release.Dockerfile
docker run --rm --platform linux/arm64 -e VERSION=2.2.5.7 -v "$PWD":/src:ro -v "$PWD/release":/out \
  -v blackbird-bun-cache:/cache blackbird-builder
```

- `--platform linux/arm64` — для Apple Silicon (под эмуляцией amd64 сборка идёт очень медленно); на Intel укажите `linux/amd64`. Набор целевых платформ от этого не зависит.
- Образ пересобирать нужно только при смене версии bun в `packageManager`.
- Без Docker то же делает `script/blackbird-release.sh <версия>` (нужен bun из `packageManager`).
- Бинарники для macOS подписаны только ad-hoc.

## Провайдер

```jsonc
// blackbird.json (в проекте) или ~/.config/blackbird/blackbird.json
{
  "model": "local/qwen",
  "provider": {
    "local": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Local",
      "options": { "baseURL": "http://127.0.0.1:1234/v1", "apiKey": "{env:LOCAL_API_KEY}" },
      "models": { "qwen": { "name": "Qwen" } }
    }
  }
}
```

## Обновление из апстрима

Линии обновляются только до релизных тегов апстрима (`v2.*` для `blackbird/v2`, `v1.*` для `blackbird/v1`), активные ветки `dev`/`v1` не используются.

```bash
script/blackbird-sync v2.2.6
```

Скрипт забирает тег из `upstream`, мержит его в текущую линию, ставит зависимости и запускает `script/blackbird-check.sh`. Проверка собирает CLI, запускает его в пустом `HOME` и падает на любом пути с `opencode`, на встроенном провайдере и на запросе к каталогу моделей.

При конфликте merge не коммитится. Разрешите конфликты, сохранив правки blackbird (они помечены комментарием `blackbird:` или заменяют `opencode` на `blackbird` в литерале), закоммитьте и запустите `script/blackbird-check.sh`. Если проверка нашла новый путь с `opencode`, исправьте литерал в апстримном файле отдельным коммитом.

## Переход с opencode

### Импорт

```bash
blackbird --opencode-import                     # всё из ~/.config, ~/.local/share и ~/.local/state opencode
blackbird --opencode-import ./opencode.json     # → ./blackbird.json
blackbird --opencode-import ./.opencode         # → ./.blackbird
```

- Имена с `opencode` переименовываются в `blackbird` (`opencode.jsonc` → `blackbird.jsonc`, `opencode.db` → `blackbird.db`).
- Существующие файлы blackbird перед перезаписью сохраняются как `.bak` (`.bak.1`, …).
- Не переносятся: кэш, `node_modules`, логи, блокировки и `service.json` запущенного opencode.
- База сессий копируется согласованным снимком, только если все её миграции известны этой сборке и в неё не писал opencode более новой мажорной версии. Иначе она пропускается с объяснением.
- Исходные файлы opencode не изменяются. На время импорта blackbird лучше не запускать.

### Режим совместимости

```bash
blackbird --opencode-compatible                 # работать прямо на файлах opencode
blackbird --opencode-compatible=/path/to/config # свой каталог конфигурации opencode
```

В этом режиме blackbird использует каталоги, конфиги, базу и ключи opencode, включает встроенные провайдеры и каталог моделей (с сетевыми запросами к нему). Обновления из релизов opencode остаются выключенными. То же самое включает переменная `BLACKBIRD_OPENCODE_COMPATIBLE=1`. Если одновременно запущен opencode, blackbird работает с той же базой и фоновым сервисом, что и он.

## Известные ограничения

- В сообщениях UI ещё встречается «OpenCode»; переименованы `--help`, заголовок и лого TUI, а также встроенные промпты: агент называет себя blackbird и настраивает `blackbird.json` (ссылки на документацию opencode.ai, пространство инструментов `opencode` и навык report остаются).
- `OPENCODE_*` по-прежнему действуют, если не задан одноимённый `BLACKBIRD_*`.
- Сетевые функции opencode (share, web search через сервисы opencode, Zen/console-интеграции) не отключались.
