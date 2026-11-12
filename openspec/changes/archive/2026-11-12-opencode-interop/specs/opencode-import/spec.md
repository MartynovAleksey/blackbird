## ADDED Requirements

### Requirement: Импорт всего состояния opencode
`blackbird --opencode-import` без пути SHALL копировать каталоги конфигурации, данных и состояния opencode (`$XDG_CONFIG_HOME/opencode`, `$XDG_DATA_HOME/opencode`, `$XDG_STATE_HOME/opencode`) в соответствующие каталоги blackbird и завершаться, не запуская агента. Кэш, логи, `node_modules`, блокировки и регистрации запущенного сервиса MUST NOT копироваться. Каталоги и база opencode MUST NOT изменяться.

#### Scenario: Полный импорт
- **WHEN** у пользователя есть `~/.config/opencode/opencode.jsonc`, `~/.local/share/opencode/auth.json` и `~/.local/state/opencode/model.json`, и он запускает `blackbird --opencode-import`
- **THEN** появляются `~/.config/blackbird/blackbird.jsonc`, `~/.local/share/blackbird/auth.json` и `~/.local/state/blackbird/model.json`, а файлы opencode остаются без изменений

#### Scenario: Отчёт
- **WHEN** импорт завершён
- **THEN** blackbird печатает, что скопировано, что сохранено в `.bak` и что пропущено с причиной

### Requirement: Переименование
Каждый сегмент пути внутри импортируемого дерева, содержащий `opencode`, SHALL переименовываться заменой `opencode` на `blackbird` (`opencode.json` → `blackbird.json`, `opencode.db` → `blackbird.db`).

#### Scenario: Вложенные имена
- **WHEN** импортируется каталог с файлом `agents/opencode-helper.md`
- **THEN** в цели появляется `agents/blackbird-helper.md`

### Requirement: Импорт по пути
`blackbird --opencode-import <path>` SHALL импортировать только указанный файл или каталог и класть результат рядом с источником: в последнем сегменте пути `opencode` заменяется на `blackbird`; если сегмент не содержит `opencode`, каталог импортируется на месте (переименовываются только вложенные имена).

#### Scenario: Проектный конфиг
- **WHEN** запущено `blackbird --opencode-import ./opencode.json`
- **THEN** рядом создаётся `./blackbird.json` с тем же содержимым

#### Scenario: Проектный каталог
- **WHEN** запущено `blackbird --opencode-import ./.opencode`
- **THEN** создаётся `./.blackbird` с тем же деревом и переименованными вложенными именами

#### Scenario: Несуществующий путь
- **WHEN** путь не существует
- **THEN** blackbird завершается с ненулевым кодом и сообщением об ошибке, ничего не создав

### Requirement: Бэкап при перезаписи
Если целевой файл уже существует, blackbird SHALL перед записью переименовать его в `<имя>.bak` (при занятом имени — `<имя>.bak.1`, `.bak.2`, …).

#### Scenario: Повторный импорт
- **WHEN** `blackbird --opencode-import` запускается второй раз
- **THEN** каждый перезаписанный файл blackbird сохранён рядом как `.bak`, данные не теряются

### Requirement: Совместимость базы сессий
База `opencode.db` SHALL копироваться согласованным снимком (`VACUUM INTO`) в `blackbird.db` только если (а) все идентификаторы миграций из её таблицы `migration` известны этой сборке и (б) мажорная версия самого нового opencode, записавшего сессию, не больше мажорной версии линии blackbird. Иначе база MUST быть пропущена с объяснением, а остальное — импортировано.

#### Scenario: База от более новой мажорной версии
- **WHEN** blackbird 1.x импортирует базу, в которую писал opencode 2.x
- **THEN** база пропускается с сообщением о версии, конфиг и ключи импортируются

#### Scenario: Совместимая база
- **WHEN** blackbird 2.x импортирует базу от opencode 2.2.x, все миграции которой известны сборке
- **THEN** создаётся `blackbird.db`, и blackbird открывает в ней сессии opencode
