## Why

Нужен собственный кодинг-агент **blackbird** на базе opencode, который выглядит для пользователя как самостоятельный продукт (никаких `opencode` в именах файлов и каталогов на его машине), не тащит встроенных провайдеров/облачных сервисов opencode и при этом дёшево подтягивает обновления из апстрима. Апстрим живёт двумя линиями — 1.x (ветка `v1`, maintenance) и 2.x (ветка `dev`, активная), — нужны обе.

## What Changes

- Репозиторий `blackbird` становится форком `github.com/anomalyco/opencode` с двумя долгоживущими ветками:
  - `blackbird/v1` — поверх апстрима `v1` (сейчас 1.19.5);
  - `blackbird/v2` — поверх апстрима `dev` (сейчас 2.2.5; ветка `v2` апстрима устарела на 2.0.26 и не используется).
- `blackbird/v2` выгружена в корень клона и хранит openspec; `blackbird/v1` — в worktree `../blackbird-v1`. Ветки пушатся в форк `origin` (MartynovAleksey/blackbird).
- Ребрендинг **только runtime-видимых имён**: бинарник `blackbird`, каталоги `~/.config|.local/share|.cache|.local/state/blackbird`, проектный каталог `.blackbird/`, конфиг `blackbird.json[c]`, файлы БД/логов, переменные окружения `BLACKBIRD_*`. Внутренние имена пакетов/директорий апстрима (`packages/opencode`, `@opencode-ai/*`) не трогаются — это и даёт дешёвый merge.
- **BREAKING (относительно opencode):** удалены все встроенные провайдеры (Anthropic, OpenAI, Zen/opencode, Copilot, Bedrock и т. д.) и загрузка каталога моделей models.dev / models.opencode.ai. Модель подключается только через провайдера, описанного пользователем в `blackbird.json` (OpenAI-совместимый и аналогичные generic-механизмы апстрима).
- Конфиги/данные opencode пользователя (`~/.config/opencode`, `.opencode/`, `opencode.json`) blackbird **не читает** — продукты изолированы.

Не входит (сознательно): переименование исходников апстрима, десктоп/веб/console/enterprise-пакеты, собственная инфраструктура релизов/автообновления, миграция настроек из opencode.

## Capabilities

### New Capabilities
- `upstream-sync`: структура форка (две ветки, remote `upstream`) и процедура обновления каждой линии из апстрима с минимальными конфликтами.
- `runtime-branding`: все имена, видимые пользователю на файловой системе и в окружении, — `blackbird`, без `opencode`.
- `provider-config`: отсутствие встроенных провайдеров и каталога моделей; подключение моделей только из пользовательского конфига.

### Modified Capabilities
<!-- нет: openspec/specs/ пуст -->

## Impact

- Код: в каждой ветке — небольшой набор правок в `packages/core` / `packages/opencode` (v1) и `packages/core` / `packages/util` / `packages/cli` / `packages/tui` (v2): app-name, имена конфигов/каталогов, bin, реестр провайдеров (`packages/core/src/plugin/provider.ts`, `internal.ts`, v1 `packages/opencode/src/plugin/index.ts`), загрузка models.dev.
- Сборка: только CLI/TUI таргет; desktop/web/console не собираются.
- Пользователи: blackbird без конфигурации провайдера не может работать — это ожидаемо и документируется.
