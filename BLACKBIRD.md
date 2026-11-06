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

## Известные ограничения

- В сообщениях UI и подсказках ещё встречается «OpenCode»; переименованы только `--help`, заголовок и лого TUI.
- `OPENCODE_*` по-прежнему действуют, если не задан одноимённый `BLACKBIRD_*`.
- Сетевые функции opencode (share, web search через сервисы opencode, Zen/console-интеграции) не отключались.
