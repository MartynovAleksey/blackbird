import type { SessionMessageAssistant, SessionMessageInfo } from "@opencode/client"
import { addedLines, callsIn, defsIn, isCode, isSource, isTestCommand, testCounts } from "./band/metrics"
import type { Tests } from "./band/types"

const EDITS = new Set(["edit", "write", "patch"])

/**
 * What the band shows for one session's messages, as ponytail's Claude Code band counts it from its hooks.
 * `known` holds the definitions the project had; `subagents` the session's subagents, whose cost goes to the turn
 * that started them, as the Claude Code band's per-turn cost includes them.
 */
export function summarize(
  messages: readonly SessionMessageInfo[],
  known: ReadonlyMap<string, string>,
  subagents: readonly { created: number; cost: number }[] = [],
) {
  // A turn runs until the session goes idle: its steps are the assistant messages between two idle markers.
  const turns: SessionMessageAssistant[][] = [[]]
  for (const message of messages) {
    if (message.type === "idle") turns.push([])
    if (message.type === "assistant") turns[turns.length - 1].push(message)
  }
  const done = turns.filter((turn) => turn.length > 0)
  const steps = done.flat()

  const busyMs = done.reduce((sum, turn) => {
    const last = turn[turn.length - 1]

    return sum + (last.time.completed ?? last.time.created) - turn[0].time.created
  }, 0)

  // The model that wrote most steps.
  const counts = steps.reduce(
    (all, step) => all.set(step.model.id, (all.get(step.model.id) ?? 0) + 1),
    new Map<string, number>(),
  )
  const model = [...counts].toSorted((a, b) => b[1] - a[1])[0]?.[0] ?? ""

  const code = {
    tests: { state: "none" } as Tests,
    created: new Set<string>(),
    reused: new Set<string>(),
    removed: new Set<string>(),
  }
  for (const part of steps.flatMap((step) => step.content)) {
    if (part.type !== "tool" || (part.state.status !== "completed" && part.state.status !== "error")) continue
    const state = part.state
    const output = (state.content ?? []).flatMap((item) => (item.type === "text" ? [item.text] : [])).join("\n")

    if (part.name === "shell" && isTestCommand(String(state.input.command ?? ""))) {
      code.tests = {
        state: state.status === "completed" && state.metadata?.exit === 0 ? "pass" : "fail",
        ...testCounts(output),
      }
      continue
    }

    if (!EDITS.has(part.name) || state.status !== "completed") continue
    // The write tool answers "Wrote" over an existing file and "Created" for a new one.
    const overwrote = part.name === "write" && output.startsWith("Wrote")
    for (const change of changes(state.input, state.metadata)) {
      const before = defsIn(change.file, change.before)
      const after = defsIn(change.file, change.after)
      const source = isSource(change.file)
      // A write over a file records no diff, so a definition the project already had is not new.
      if (source)
        after
          .filter((name) => !before.includes(name) && !(overwrote && known.has(name)))
          .forEach((name) => code.created.add(name))
      before.filter((name) => !after.includes(name)).forEach((name) => code.removed.add(name))
      // Names this session defined are its own code, not reuse of what the project had.
      if (source)
        callsIn(addedLines(change.before, change.after), known, [...after, ...code.created]).forEach((name) =>
          code.reused.add(name),
        )
      if (isCode(change.file) && code.tests.state !== "none") code.tests = { ...code.tests, state: "stale" }
    }
  }

  return {
    turns: done.length,
    turnCosts: done.map(
      (turn, index) =>
        turn.reduce((sum, step) => sum + (step.cost ?? 0), 0) +
        subagents
          .filter(
            (agent) =>
              (index === 0 || agent.created >= turn[0].time.created) &&
              (index === done.length - 1 || agent.created < done[index + 1][0].time.created),
          )
          .reduce((sum, agent) => sum + agent.cost, 0),
    ),
    busyMs,
    model,
    tests: code.tests,
    created: [...code.created],
    reused: [...code.reused],
    // A definition removed and then written again is not removed.
    removed: [...code.removed].filter((name) => !code.created.has(name)),
  }
}

/** The files an edit, write or patch changed, from the diffs the tools record, else a write's new content. */
export function changes(input: Readonly<Record<string, unknown>>, metadata: unknown) {
  const files =
    metadata && typeof metadata === "object" && "files" in metadata && Array.isArray(metadata.files)
      ? metadata.files
      : []
  const diffs = files.flatMap((file) =>
    file && typeof file.file === "string" && typeof file.patch === "string"
      ? [{ file: file.file, patch: file.patch }]
      : [],
  )
  if (diffs.length > 0) return diffs.map((diff) => ({ file: diff.file, ...sides(diff.patch) }))
  // shortcut: a write without a recorded diff counts the whole file as new, so its definitions read as created.
  return typeof input.path === "string" && typeof input.content === "string"
    ? [{ file: input.path, before: "", after: input.content }]
    : []
}

// The old and new text of a unified diff's hunks.
function sides(patch: string) {
  const lines = patch
    .split("\n")
    .filter((line) => !line.startsWith("---") && !line.startsWith("+++") && !line.startsWith("@@"))
  const keep = (mark: string) =>
    lines.flatMap((line) => (line.startsWith(mark) || line.startsWith(" ") ? [line.slice(1)] : [])).join("\n")

  return { before: keep("-"), after: keep("+") }
}
