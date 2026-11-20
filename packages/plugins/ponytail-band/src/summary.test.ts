import { expect, test } from "bun:test"
import type { SessionMessageInfo } from "@opencode/client"
import { elapsed, fmtTokens, testCounts } from "./band/metrics"
import { changes, summarize } from "./summary"

const tokens = { input: 100, output: 20, reasoning: 0, cache: { read: 1000, write: 10 } }

const step = (created: number, completed: number, cost: number, content: unknown[] = []) => ({
  type: "assistant",
  model: { id: "bonsai", providerID: "lmstudio" },
  time: { created, completed },
  cost,
  tokens,
  content,
})

const tool = (name: string, input: Record<string, unknown>, status: string, metadata?: Record<string, unknown>) => ({
  type: "tool",
  name,
  state: { status, input, metadata, content: [{ type: "text", text: "3 passed" }] },
})

const diff = (file: string, before: string, after: string) => ({
  files: [
    {
      file,
      patch: [
        `--- ${file}`,
        `+++ ${file}`,
        "@@ -1 +1 @@",
        ...before.split("\n").map((l) => `-${l}`),
        ...after.split("\n").map((l) => `+${l}`),
      ].join("\n"),
    },
  ],
})

const run = (
  messages: unknown[],
  known = new Map<string, string>(),
  subagents: { created: number; cost: number }[] = [],
) => summarize(messages as SessionMessageInfo[], known, subagents)

test("splits turns at idle markers and adds their cost and time", () => {
  const summary = run(
    [
      { type: "user" },
      step(0, 1_000, 0.5),
      step(1_000, 3_000, 0.25),
      { type: "idle", outcome: "succeeded" },
      { type: "user" },
      step(10_000, 15_000, 1),
    ],
    undefined,
    [
      { created: 500, cost: 2 },
      { created: 12_000, cost: 3 },
    ],
  )

  expect(summary.turns).toBe(2)
  // Each subagent's cost goes to the turn that started it.
  expect(summary.turnCosts).toEqual([2.75, 4])
  expect(summary.busyMs).toBe(3_000 + 5_000)
  expect(summary.model).toBe("bonsai")
})

test("the last test run wins with its counts, and a code edit after it makes it stale", () => {
  const pass = tool("shell", { command: "bun test src" }, "completed", { exit: 0 })
  const fail = tool("shell", { command: "cd pkg && bun test" }, "completed", { exit: 1 })
  const edit = tool("edit", { path: "a.ts" }, "completed", diff("src/a.ts", "const a = 1", "const a = 2"))
  const other = tool("shell", { command: "ls" }, "completed", { exit: 0 })

  expect(run([step(0, 1, 0, [other])]).tests).toEqual({ state: "none" })
  expect(run([step(0, 1, 0, [fail, pass, other])]).tests).toEqual({ state: "pass", passed: 3, failed: undefined })
  expect(run([step(0, 1, 0, [pass, fail])]).tests.state).toBe("fail")
  expect(run([step(0, 1, 0, [pass]), step(1, 2, 0, [edit])]).tests.state).toBe("stale")
})

test("a write over a file does not count the project's existing definitions as new; a new file's are", () => {
  const known = new Map([["parseConfig", "src/a.ts:1"]])
  const write = (answer: string) => ({
    type: "tool",
    name: "write",
    state: {
      status: "completed",
      input: { path: "src/a.ts", content: "export function parseConfig() {}\nexport function fresh() {}" },
      content: [{ type: "text", text: `${answer} file successfully: src/a.ts` }],
    },
  })

  expect(run([step(0, 1, 0, [write("Wrote")])], known).created).toEqual(["fresh"])
  // The definitions may be in the project's grep only because this session wrote them.
  expect(run([step(0, 1, 0, [write("Created")])], known).created).toEqual(["parseConfig", "fresh"])
})

test("edits count new, reused and removed definitions like the Claude Code band", () => {
  const known = new Map([
    ["parseConfig", "src/config.ts:3"],
    ["oldHelper", "src/util.ts:1"],
  ])
  const edit = tool(
    "edit",
    {},
    "completed",
    diff(
      "src/app.ts",
      "export function oldHelper() {}",
      "export function loadApp() {\n  return parseConfig(read())\n}",
    ),
  )
  const summary = run([step(0, 1, 0, [edit])], known)

  expect(summary.created).toEqual(["loadApp"])
  expect(summary.reused).toEqual(["parseConfig"])
  expect(summary.removed).toEqual(["oldHelper"])
})

test("a write without a recorded diff counts its content as new", () => {
  expect(changes({ path: "a.ts", content: "x" }, undefined)).toEqual([{ file: "a.ts", before: "", after: "x" }])
  expect(changes({}, diff("b.ts", "old", "new"))).toEqual([{ file: "b.ts", before: "old", after: "new" }])
})

test("reads bun test's pass and fail counts", () => {
  expect(testCounts(" 1 pass\n 2 fail\n 1 expect() calls")).toEqual({ passed: 1, failed: 2 })
})

test("formats like ponytail's band", () => {
  expect(fmtTokens(309_600_000)).toBe("309.6M")
  expect(elapsed(15 * 3_600_000 + 8 * 60_000)).toBe("15h 8m")
})
