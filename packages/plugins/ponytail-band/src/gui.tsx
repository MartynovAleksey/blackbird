import { execFile } from "node:child_process"
import { existsSync, readFileSync, unwatchFile, watchFile } from "node:fs"
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import path from "node:path"
import { shell } from "electron"
import { Schema } from "effect"
import { createMemo, createSignal, For, onCleanup, Show } from "solid-js"
import {
  createKeyed,
  createLatest,
  Ipc,
  Plugin,
  SettingsPage,
  Slot,
  Store,
  type MountedSession,
  type SessionScreen,
} from "@opencode/plugin/gui"
import { boardHtml, tasksFrom } from "./band/board"
import {
  csvRow,
  elapsed,
  fmtTokens,
  GREP_DEFS,
  hits,
  defsIn,
  markdown,
  metricsSvg,
  parseDefs,
  percent,
  snapshot,
  testsLabel,
  totalTokens,
  upsertCsv,
  type Col,
} from "./band/metrics"
import type { Band } from "./band/types"
import { summarize } from "./summary"

const LEVELS = ["off", "lite", "full", "ultra"]
// The value colors of ponytail's metrics SVG (metricsSvg's STYLE), so callers and tests read the same in both views.
const TONES = `[data-component=ponytail-band] .tone-value{color:#1f1e1d}[data-component=ponytail-band] .tone-warning{color:#a86400}[data-component=ponytail-band] .tone-success{color:#2e7d32}[data-component=ponytail-band] .tone-error{color:#c62828}@media (prefers-color-scheme:dark){[data-component=ponytail-band] .tone-value{color:#ecebe6}[data-component=ponytail-band] .tone-warning{color:#e3a03d}[data-component=ponytail-band] .tone-success{color:#6abf69}[data-component=ponytail-band] .tone-error{color:#ef6a5a}}`
// The parts of the band the settings can hide.
const PARTS = [
  { key: "level", title: "Level" },
  { key: "cost", title: "Cost" },
  { key: "last", title: "Last turn's cost" },
  { key: "time", title: "Agent time" },
  { key: "tokens", title: "Tokens", description: "In Details." },
  { key: "reuse", title: "Reuse" },
  { key: "callers", title: "Open callers" },
  { key: "tests", title: "Tests" },
  { key: "copy", title: "Copy", description: "In Details." },
  { key: "review", title: "Review" },
  { key: "audit", title: "Audit" },
  { key: "board", title: "Board" },
]

/** What only main can do: read ponytail's level file, grep the project, and keep the task ledger and its board. */
const Main = Ipc.define({
  id: "ponytail-band",
  // The level ponytail's server plugin keeps in a file; empty while the file is absent.
  state: Schema.String,
  methods: {
    /** The project's definitions, name to "file:line". */
    defs: { input: Schema.String, output: Schema.Record(Schema.String, Schema.String) },
    /** Where removed definitions that are not defined again are still called, as "file:line". */
    callers: {
      input: Schema.Struct({ directory: Schema.String, names: Schema.Array(Schema.String) }),
      output: Schema.Array(Schema.String),
    },
    /** Writes the task's row to its project's ledger and rebuilds the board. */
    record: { input: Schema.Struct({ project: Schema.String, key: Schema.String, row: Schema.String }) },
    /** Rebuilds the board and opens it in the browser. */
    board: {},
  },
})

export default Plugin.define({
  stores: {
    // Whether the band shows its details, kept across sessions as in Claude Code, and the parts hidden in settings.
    band: Store.global(Schema.Struct({ details: Schema.Boolean, hidden: Schema.Array(Schema.String) }), {
      details: false,
      hidden: [],
    }),
  },

  setup(ctx) {
    const main = ctx.main(Main)
    const store = ctx.stores.band
    const shown = (part: string) => !store.value.hidden.includes(part)

    ctx.add(SettingsPage, {
      id: "ponytail-band",
      title: "ponytail band",
      entries: PARTS.map((part) => ({ id: `ponytail-band-${part.key}`, title: part.title })),
      render: () => (
        <ctx.ui.SettingsLayout title="ponytail band" description="The parts the band above the composer shows.">
          <ctx.ui.SettingsSection>
            <For each={PARTS}>
              {(part) => (
                <ctx.ui.SettingsRow id={`ponytail-band-${part.key}`} title={part.title} description={part.description}>
                  <ctx.ui.Switch
                    label={part.title}
                    hideLabel
                    checked={shown(part.key)}
                    onChange={(on) =>
                      store.update((draft) => {
                        draft.hidden = on ? draft.hidden.filter((key) => key !== part.key) : [...draft.hidden, part.key]
                      })
                    }
                  />
                </ctx.ui.SettingsRow>
              )}
            </For>
          </ctx.ui.SettingsSection>
        </ctx.ui.SettingsLayout>
      ),
    })

    const View = (props: { session: MountedSession; screen: SessionScreen }) => {
      const data = () => props.session.server.data.session
      const id = () => props.session.id
      const directory = () => props.session.directory
      // ponytail's server plugin falls back to its default level, `full`, while the file is absent.
      // shortcut: a default changed in ~/.config/ponytail/config.json is not read; read it in main if that matters.
      // A clicked level shows at once, as in Claude Code, until ponytail's file says otherwise.
      const [picked, setPicked] = createSignal<string>()
      createKeyed(main.state, () => setPicked(undefined))
      const level = () => picked() ?? (main.state() || "full")

      const known = createLatest(directory, (dir, signal) => main.defs(dir, { signal }))
      const knownMap = createMemo(() => new Map(Object.entries(known.latest ?? {})))
      // The session and its subagents, as the server's cost counts them.
      const family = () => (id() ? [...new Set([id() ?? "", ...data().family(id() ?? "")])] : [])
      const subagents = () =>
        family().flatMap((other) => {
          const info = other === id() ? undefined : data().get(other)
          return info ? [{ created: info.time.created, cost: info.cost }] : []
        })
      const sum = createMemo(() => summarize(id() ? data().message.list(id() ?? "") : [], knownMap(), subagents()))
      const tokens = () =>
        family().reduce(
          (total, other) => {
            const used = data().get(other)?.tokens
            if (!used) return total
            return {
              input: total.input + used.input,
              output: total.output + used.output + used.reasoning,
              cacheRead: total.cacheRead + used.cache.read,
              cacheWrite: total.cacheWrite + used.cache.write,
            }
          },
          { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        )
      const idle = () => !!id() && data().status(id() ?? "") === "idle"

      // Checked once a turn ends, as the Claude Code band does, so streaming edits run no grep.
      const callers = createLatest(
        () =>
          idle() && sum().removed.length > 0 ? JSON.stringify([directory(), sum().removed, sum().turns]) : undefined,
        (key, signal) => {
          const [dir, names] = JSON.parse(key) as [string, string[]]

          return main.callers({ directory: dir, names }, { signal })
        },
      )

      const band = createMemo((): Band => {
        const s = sum()
        const info = id() ? data().get(id() ?? "") : undefined

        return {
          level: level(),
          model: s.model,
          spent: id() ? data().cost(id() ?? "") : 0,
          turns: s.turns,
          turnCosts: s.turnCosts.slice(-20),
          tokens: tokens(),
          busyMs: s.busyMs,
          name: info?.title ?? "",
          // The window has no node:path; the main entry gets it.
          project:
            (props.session.project?.worktree ?? directory())
              .replace(/[\\/]+$/, "")
              .split(/[\\/]/)
              .pop() ?? "",
          session: id() ?? "",
          reused: s.reused,
          created: s.created,
          openCallers: callers.latest ? [...callers.latest] : [],
          tests: s.tests,
        }
      })
      const startedAt = () => (id() ? (data().get(id() ?? "")?.time.created ?? 0) : 0)
      const row = createMemo(() => snapshot(band(), startedAt()))

      // After every turn: the task's row in its project's ledger, which the board reads.
      createKeyed(
        () => (idle() && band().turns > 0 && band().project !== "" ? csvRow(row()) : undefined),
        (line) => void main.record({ project: band().project, key: row().key, row: line }).catch(() => undefined),
      )

      // The same commands a person types, sent at once rather than put in the composer.
      const run = (name: string, text = "") => {
        const client = ctx.servers.get(props.session.server.id)?.client
        const sessionID = id()
        if (!client || !sessionID) return Promise.resolve(false)

        return client.session.command({ sessionID, name, text }).then(
          () => true,
          () => {
            ctx.toast.show({ title: `ponytail band: /${name} failed`, variant: "error" })
            return false
          },
        )
      }
      const setLevel = (name: string) => {
        setPicked(name)
        void run("ponytail", name).then((ok) => ok || setPicked(undefined))
      }
      const toggle = () => store.update((draft) => void (draft.details = !draft.details))
      const copy = () =>
        void ctx.system.copy(markdown(row())).then(
          () => ctx.toast.show({ title: "Task copied as Markdown" }),
          (error: unknown) => ctx.toast.show({ title: `Copy failed: ${String(error)}`, variant: "error" }),
        )
      const board = () =>
        void main
          .board()
          .catch(() => ctx.toast.show({ title: "ponytail band: could not open the board", variant: "error" }))

      const reuse = () => percent(band().reused.length, band().created.length)
      const last = () => band().turnCosts.at(-1)
      const avg = () => (band().turns > 0 ? band().spent / band().turns : 0)
      const tests = () => band().tests
      const testsText = () =>
        tests().state === "pass"
          ? `✓ ${tests().passed ?? ""} tests`
          : tests().state === "fail"
            ? `✗ ${tests().failed ?? ""} failed`
            : tests().state === "stale"
              ? "no test since change"
              : "no tests"
      const testsTone = () =>
        tests().state === "pass" ? "tone-success" : tests().state === "fail" ? "tone-error" : "tone-value"

      // Every column the settings leave shown, with a dash or zero until there is something to report.
      const cols = createMemo((): Col[] => {
        const b = band()
        const all: Col[] = [
          {
            key: "cost",
            label: "cost",
            value: `$${b.spent.toFixed(2)}`,
            sub:
              last() === undefined || !shown("last")
                ? ""
                : `last $${(last() ?? 0).toFixed(2)} · ⌀ $${avg().toFixed(2)}`,
          },
          {
            key: "tokens",
            label: "tokens",
            value: fmtTokens(totalTokens(b.tokens)),
            sub: `${b.turns} ${b.turns === 1 ? "turn" : "turns"}`,
          },
          {
            key: "time",
            label: "agent time",
            value: elapsed(b.busyMs),
            sub: b.turns > 0 ? `⌀ ${elapsed(b.busyMs / b.turns)} / turn` : "",
          },
          { key: "reuse", label: "reuse", value: reuse() === undefined ? "—" : `${reuse()}%`, sub: "" },
          {
            key: "callers",
            label: "callers",
            value: `${b.openCallers.length} open`,
            sub: b.openCallers.slice(0, 2).join(", "),
            tone: b.openCallers.length > 0 ? "warning" : undefined,
          },
          {
            key: "tests",
            label: "tests",
            value: b.tests.state === "none" ? "—" : testsLabel(b.tests),
            sub:
              b.tests.state === "pass"
                ? "after last change"
                : b.tests.state === "fail"
                  ? "last run"
                  : b.tests.state === "stale"
                    ? "code changed since"
                    : "not run",
            tone: b.tests.state === "pass" ? "success" : b.tests.state === "fail" ? "error" : undefined,
          },
        ]

        return all.filter((col) => shown(col.key))
      })

      // The metrics row is ponytail's own SVG, as the Claude Code desktop draws it, sized to the band's width.
      const svg = (element: HTMLDivElement) => {
        const draw = () => {
          element.innerHTML = metricsSvg(cols(), band().turnCosts, Math.max(320, Math.floor(element.clientWidth)))
        }
        const observer = new ResizeObserver(draw)
        observer.observe(element)
        createKeyed(() => JSON.stringify([cols(), band().turnCosts]), draw)
        onCleanup(() => observer.disconnect())
      }

      const Button = (button: { label: string; onClick: () => void; selected?: boolean; dim?: boolean }) => (
        <ctx.ui.Button
          size="small"
          variant={button.selected ? "contrast" : button.dim ? "ghost-muted" : "ghost"}
          onClick={button.onClick}
        >
          {button.label}
        </ctx.ui.Button>
      )
      // A row; built per use, because Solid lets a spread style win over the keys written after it.
      const line = (gap: string, wrap = false) => ({
        display: "flex",
        "align-items": "center",
        gap,
        "white-space": wrap ? "normal" : "nowrap",
      })
      const weak = { color: "var(--text-weak)" }

      return (
        <Show when={id()}>
          <div
            data-component="ponytail-band"
            style={{
              margin: "0 0 8px",
              padding: "10px 14px",
              "border-radius": "12px",
              background: "var(--surface-base)",
              color: "var(--text-strong)",
              "font-size": "14px",
            }}
          >
            <style>{TONES}</style>
            <Show
              when={store.value.details}
              fallback={
                <div style={line("24px")}>
                  {/* One row, as in Claude Code: a metric short of room wraps its own text, and the buttons stay in view. */}
                  <div style={{ ...line("20px", true), "line-height": "20px", flex: "1", "min-width": "0" }}>
                    {/* A click opens the four levels: one click, no stops on levels nobody wanted. */}
                    <Show when={shown("level")}>
                      <ctx.ui.Button size="small" variant="ghost" onClick={toggle}>
                        <span style={{ color: level() === "off" ? "var(--text-weaker)" : "var(--text-strong)" }}>
                          ●
                        </span>{" "}
                        {level()}
                      </ctx.ui.Button>
                    </Show>
                    <Show when={shown("cost")}>
                      <span>${band().spent.toFixed(2)}</span>
                    </Show>
                    <Show when={shown("last")}>
                      <span style={weak}>last ${(last() ?? 0).toFixed(2)}</span>
                    </Show>
                    <Show when={shown("time")}>
                      <span style={weak}>{elapsed(band().busyMs)}</span>
                    </Show>
                    <Show when={shown("reuse")}>
                      <span style={reuse() === undefined ? weak : {}}>
                        {reuse() === undefined ? "—" : `${reuse()}%`} reuse
                      </span>
                    </Show>
                    <Show when={shown("callers")}>
                      <span class={band().openCallers.length > 0 ? "tone-warning" : "tone-value"}>
                        {band().openCallers.length > 0 ? "⚠ " : ""}
                        {band().openCallers.length} callers open
                      </span>
                    </Show>
                    <Show when={shown("tests")}>
                      <span class={testsTone()}>{testsText()}</span>
                    </Show>
                  </div>
                  <div style={{ ...line("4px"), "flex-shrink": "0" }}>
                    <Show when={shown("review")}>
                      <Button label="Review" onClick={() => run("ponytail-review")} />
                    </Show>
                    <Show when={shown("audit")}>
                      <Button label="Audit" onClick={() => run("ponytail-audit")} />
                    </Show>
                    <Show when={shown("board")}>
                      <Button label="Board" onClick={board} />
                    </Show>
                    <Button label="Details" onClick={toggle} />
                  </div>
                </div>
              }
            >
              <div style={{ display: "flex", "flex-direction": "column", gap: "8px" }}>
                <div style={line("4px")}>
                  <Show when={shown("level")}>
                    <For each={LEVELS}>
                      {(name) => <Button label={name} selected={name === level()} dim onClick={() => setLevel(name)} />}
                    </For>
                  </Show>
                  <div style={{ flex: "1" }} />
                  <Show when={shown("copy")}>
                    <Button label="Copy" onClick={copy} />
                  </Show>
                  <Show when={shown("review")}>
                    <Button label="Review" onClick={() => run("ponytail-review")} />
                  </Show>
                  <Show when={shown("audit")}>
                    <Button label="Audit" onClick={() => run("ponytail-audit")} />
                  </Show>
                  <Show when={shown("board")}>
                    <Button label="Board" onClick={board} />
                  </Show>
                  <Button label="Compact" onClick={toggle} />
                </div>
                <div
                  ref={svg}
                  role="img"
                  aria-label={cols()
                    .map((c) => `${c.label} ${c.value}`)
                    .join(", ")}
                />
              </div>
            </Show>
          </div>
        </Show>
      )
    }

    ctx.add(Slot, {
      at: "experimental.session.composer",
      render: (input) => <View session={input.session} screen={input.screen} />,
    })
  },

  main(ctx) {
    // shortcut: this machine's files and git, so a remote server's project and level are not seen; add an RPC to the server plugin then.
    const config = process.env.XDG_CONFIG_HOME ?? path.join(homedir(), ".config")
    const levelFile = path.join(config, "opencode", ".ponytail-active")
    const ledger = path.join(config, "ponytail", "band")
    const grep = (directory: string, args: string[]) =>
      new Promise<string>((resolve) =>
        execFile(
          "git",
          ["grep", "--untracked", ...args],
          { cwd: directory, maxBuffer: 64 * 1024 * 1024 },
          (_, stdout) => resolve(stdout ?? ""),
        ),
      )
    const writeBoard = async () => {
      const files = (await readdir(ledger).catch(() => [])).filter((name) => name.endsWith(".csv"))
      const texts = await Promise.all(files.map((name) => readFile(path.join(ledger, name), "utf8").catch(() => "")))
      const file = path.join(ledger, "board.html")
      await writeFile(file, boardHtml(texts.flatMap(tasksFrom), Date.now()))
      return file
    }

    const provider = ctx.provide(Main, {
      state: () => (existsSync(levelFile) ? readFileSync(levelFile, "utf8").trim() : ""),
      defs: async (directory) => Object.fromEntries(parseDefs(await grep(directory, ["-nE", GREP_DEFS]))),
      // A removed or renamed definition that is not defined again but still called somewhere.
      // shortcut: name match with git grep, so a same-named call in another module counts too.
      callers: async (input) => {
        const rows = await Promise.all(
          input.names.map(async (name) => {
            const found = hits(await grep(input.directory, ["-nw", "-e", name]))
            if (found.some((r) => defsIn(r.file, r.text.trimStart()).includes(name))) return []
            const call = new RegExp(`(?<![\\w$])${name.replace(/\$/g, "\\$")}\\s*\\(`)
            return found.filter((r) => call.test(r.text)).map((r) => `${r.file}:${r.line}`)
          }),
        )
        return rows.flat()
      },
      record: async (input) => {
        await mkdir(ledger, { recursive: true })
        const file = path.join(ledger, `${input.project.replace(/[^\w.-]/g, "_")}.csv`)
        await writeFile(file, upsertCsv(await readFile(file, "utf8").catch(() => ""), input.key, input.row))
        await writeBoard()
      },
      board: async () => {
        await mkdir(ledger, { recursive: true })
        await shell.openPath(await writeBoard())
      },
    })

    watchFile(levelFile, { interval: 1000 }, () => provider.changed())
    ctx.onCleanup(() => unwatchFile(levelFile))
  },
})
