// ponytail's band state (hooks/band/types.d.ts), without the Claude Code module declaration.
export type Tests = {
  state: "none" | "pass" | "fail" | "stale"
  passed?: number
  failed?: number
}

export type Tokens = { input: number; output: number; cacheRead: number; cacheWrite: number }

export type Band = {
  level: string
  model: string
  spent: number
  turns: number
  turnCosts: number[]
  tokens: Tokens
  busyMs: number
  name: string
  project: string
  session: string
  reused: string[]
  created: string[]
  openCallers: string[]
  tests: Tests
}
