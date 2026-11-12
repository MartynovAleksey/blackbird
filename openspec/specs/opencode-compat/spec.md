# opencode-compat Specification

## Purpose
Режим `--opencode-compatible`: blackbird работает на каталогах, конфигах и базе opencode.

## Requirements

### Requirement: Режим совместимости с opencode
При запуске с флагом `--opencode-compatible` (или переменной `BLACKBIRD_OPENCODE_COMPATIBLE=1`) blackbird SHALL использовать имена opencode вместо blackbird для всех путей и файлов: XDG-каталоги `opencode`, `opencode.json[c]`, `.opencode/`, `opencode.db`, логи и системные каталоги конфигурации. Флаг SHALL удаляться из аргументов до разбора CLI и действовать для дочерних процессов (фоновый сервис).

#### Scenario: Конфиг opencode применяется
- **WHEN** в проекте лежит только `opencode.json` с моделью, и запущено `blackbird --opencode-compatible run "…"`
- **THEN** blackbird использует настройки из `opencode.json`

#### Scenario: Данные opencode
- **WHEN** blackbird запущен с `--opencode-compatible`
- **THEN** сессии читаются и пишутся в `opencode.db` в каталоге данных opencode, а каталоги `blackbird` не создаются

#### Scenario: Общая база как в opencode
- **WHEN** в `opencode.db` писали opencode 1.x и 2.x
- **THEN** blackbird в режиме совместимости работает с ней так же, как opencode той же линии (без дополнительных проверок схемы)

#### Scenario: Без флага поведение прежнее
- **WHEN** blackbird запущен без флага
- **THEN** файлы opencode не читаются (требования `runtime-branding` действуют)

### Requirement: Каталог конфигурации opencode
`--opencode-compatible=<dir>` SHALL дополнительно задавать каталог конфигурации opencode так же, как `OPENCODE_CONFIG_DIR` в opencode.

#### Scenario: Свой каталог
- **WHEN** запущено `blackbird --opencode-compatible=/srv/oc-config models` и в `/srv/oc-config/opencode.json` описан провайдер
- **THEN** модели этого провайдера есть в списке

### Requirement: Провайдеры в режиме совместимости
В режиме совместимости blackbird SHALL регистрировать встроенные провайдеры, их auth-плагины и каталог моделей так же, как opencode. Проверки и установка обновлений из релизов opencode MUST оставаться отключёнными.

#### Scenario: Встроенный провайдер
- **WHEN** задан `ANTHROPIC_API_KEY` и blackbird запущен с `--opencode-compatible models`
- **THEN** в списке есть модели `anthropic/…`
