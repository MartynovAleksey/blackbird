# runtime-branding Specification

## Purpose
На машине пользователя продукт называется `blackbird`: бинарник, каталоги, проектные файлы, конфиг и переменные окружения.

## Requirements

### Requirement: Имя бинарника
Собранный CLI каждой линии SHALL называться `blackbird`; MUST NOT устанавливаться исполняемый файл или симлинк, содержащий `opencode` в имени.

#### Scenario: Установленный бинарник
- **WHEN** пользователь собирает и устанавливает CLI любой линии
- **THEN** в `PATH` появляется `blackbird`, а `opencode`/`opencode2` не появляется

### Requirement: Глобальные каталоги
Агент SHALL хранить данные, кэш, конфиг, состояние и временные файлы в XDG-каталогах с именем `blackbird` (`~/.local/share/blackbird`, `~/.cache/blackbird`, `~/.config/blackbird`, `~/.local/state/blackbird`, `$TMPDIR/blackbird`).

#### Scenario: Чистый запуск
- **WHEN** пользователь впервые запускает `blackbird` в пустом `$HOME`
- **THEN** в `$HOME` и `$TMPDIR` создаются только пути с `blackbird` в имени, и `find $HOME $TMPDIR -iname '*opencode*'` ничего не находит

### Requirement: Проектные файлы и конфиг
Агент SHALL искать проектный конфиг в `blackbird.json` / `blackbird.jsonc` и проектный каталог `.blackbird/` (агенты, команды, плагины, скиллы); файлы БД и логов SHALL иметь имена с `blackbird` либо без имени продукта. Файлы `opencode.json*` и каталоги `.opencode/`, `~/.config/opencode` MUST NOT читаться.

#### Scenario: Конфиг blackbird применяется
- **WHEN** в проекте лежит `blackbird.json` с настройкой модели
- **THEN** `blackbird` использует эту настройку

#### Scenario: Конфиг opencode игнорируется
- **WHEN** в проекте лежит только `opencode.json`
- **THEN** `blackbird` его не читает и работает как без конфига

#### Scenario: Сессия не создаёт opencode-файлов в проекте
- **WHEN** пользователь проводит сессию в проекте
- **THEN** `find . -iname '*opencode*'` по файлам, созданным агентом, ничего не находит

### Requirement: Переменные окружения
Агент SHALL принимать настройки через переменные `BLACKBIRD_*` с теми же суффиксами, что у апстримных `OPENCODE_*`; при наличии обеих значение `BLACKBIRD_*` SHALL иметь приоритет.

#### Scenario: Переопределение каталога конфига
- **WHEN** задан `BLACKBIRD_CONFIG_DIR=/tmp/bb`
- **THEN** агент читает конфиг из `/tmp/bb`

### Requirement: Видимое имя продукта
CLI (`--help`, `--version`, заголовок/лого TUI) SHALL показывать имя `blackbird`.

#### Scenario: Справка
- **WHEN** пользователь запускает `blackbird --help`
- **THEN** в выводе имя команды и продукта — `blackbird`

### Requirement: Автоматическая проверка ребрендинга
Каждая ветка SHALL содержать скрипт проверки, который запускает собранный CLI в изолированном `$HOME` и падает, если на файловой системе появился путь, содержащий `opencode`.

#### Scenario: Регрессия после merge
- **WHEN** апстрим добавил новый путь вида `path.join(..., "opencode")` и выполнен sync
- **THEN** проверка ребрендинга падает и печатает найденный путь
