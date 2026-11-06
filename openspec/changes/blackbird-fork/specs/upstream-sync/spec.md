## ADDED Requirements

### Requirement: Две линии форка
Репозиторий SHALL содержать две долгоживущие ветки кода: `blackbird/v1`, основанную на апстрим-ветке `v1`, и `blackbird/v2`, основанную на апстрим-ветке `dev` репозитория `github.com/anomalyco/opencode`. Апстрим SHALL быть подключён как git remote `upstream`.

#### Scenario: Ветки и remote существуют
- **WHEN** разработчик выполняет `git branch -a` и `git remote -v` в репозитории blackbird
- **THEN** видны ветки `blackbird/v1`, `blackbird/v2` и remote `upstream`, указывающий на `github.com/anomalyco/opencode`

#### Scenario: Происхождение веток
- **WHEN** выполняется `git merge-base blackbird/v2 upstream/dev`
- **THEN** возвращается коммит апстрима `dev` (ветка не является независимой копией)

### Requirement: Обновление из апстрима одной командой
Для каждой линии SHALL существовать документированная процедура обновления (`script/blackbird-sync` в каждой ветке), которая делает `git fetch upstream` и `git merge` соответствующей апстрим-ветки в ветку blackbird, после чего прогоняет проверку ребрендинга.

#### Scenario: Чистое обновление
- **WHEN** апстрим добавил коммиты, не затрагивающие изменённые blackbird строки, и в `blackbird/v2` запущен `script/blackbird-sync`
- **THEN** merge проходит без конфликтов и проверка ребрендинга зелёная

#### Scenario: Конфликт
- **WHEN** апстрим изменил строку, которую правит blackbird
- **THEN** скрипт останавливается на конфликте git, ничего не коммитит автоматически и сообщает, какие файлы конфликтуют

### Requirement: Минимальная поверхность изменений
Изменения blackbird относительно апстрима SHALL ограничиваться правкой строк в существующих файлах и добавлением новых файлов; файлы апстрима MUST NOT удаляться или переименовываться.

#### Scenario: Diff не содержит удалений и переименований файлов
- **WHEN** выполняется `git diff --name-status upstream/dev...blackbird/v2`
- **THEN** в выводе нет записей со статусом `D` или `R`
