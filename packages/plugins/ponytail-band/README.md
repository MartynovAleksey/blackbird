# ponytail band

ponytail's Claude Code band for the blackbird desktop app: a strip above the composer with the task's cost, agent time,
reuse and tests, and buttons for the ponytail level, `/ponytail-review`, `/ponytail-audit` and the Board. Details shows
the levels, Copy, Review, Audit, Board and Compact, and a row of cost (with a sparkline of the last turns), tokens,
agent time, reuse, open callers and tests. The choice between compact and details is kept across sessions.

Every part shows from the start, with a dash until there is something to count. Settings → ponytail band hides any
of them: the level, cost, last turn's cost, agent time, tokens, reuse, open callers, tests, and the Copy, Review, Audit
and Board buttons.

The buttons run ponytail's own commands in the session, so install ponytail's server plugin too. The band needs the
`experimental.session.composer` slot: a blackbird built from `blackbird/v2` with that slot; an app without it loads the
plugin but shows no band.

It is a GUI-only plugin: one CommonJS bundle the app loads at runtime. The counting and the Board are ponytail's own
code (`src/band`, from ponytail's `hooks/band`, MIT).

## Build

```bash
bun install
cd packages/plugins/ponytail-band
bun run build
```

The bundle is `dist/gui-experimental.cjs`.

## Connect it

Add the package directory, next to ponytail, to `plugins` in `~/.config/blackbird/blackbird.jsonc` (every project) or
`blackbird.json` in a project:

```jsonc
{
  "plugins": ["@dietrichgebert/ponytail", "/absolute/path/to/packages/plugins/ponytail-band"],
}
```

The app reloads the band when `dist/gui-experimental.cjs` changes; restart it if the band does not show after the config
edit. To use it on another
machine, copy the directory with `package.json` and `dist/`.

## What it counts

- Cost and tokens are the server's totals for the session and its subagents. A turn's cost (last, the sparkline)
  includes the subagents it started. Agent time counts the session's own turns.
- A turn runs until the session goes idle. Agent time is the sum of the turns' durations.
- Tests: the last `shell` call that runs a known test runner (`bun test`, `jest`, `vitest`, `pytest`, `go test`,
  `cargo test` and others), with the pass and fail counts from its output. A code edit after it shows
  "no test since change".
- Reuse: definitions the session's edits call that the project already had (from `git grep` of the project), against
  the definitions it created. Callers open: definitions it removed that are still called somewhere.
- After every turn the task's row goes to `~/.config/ponytail/band/<project>.csv`, the same ledger the Claude Code
  band writes, and Board opens `board.html` built from all of them.
- The level is read from `~/.config/opencode/.ponytail-active`, the file ponytail's server plugin writes; without it,
  ponytail's default, `full`.
- Files, git and the level are read on this machine, so a session on a remote server shows no reuse or level.
