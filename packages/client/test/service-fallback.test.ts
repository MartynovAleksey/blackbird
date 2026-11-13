import { afterEach, expect, test } from "bun:test"
import { fallback } from "../src/service-probe"

const saved = { state: process.env.XDG_STATE_HOME, compat: process.env.BLACKBIRD_OPENCODE_COMPATIBLE }

afterEach(() => {
  process.env.XDG_STATE_HOME = saved.state
  process.env.BLACKBIRD_OPENCODE_COMPATIBLE = saved.compat
  if (saved.state === undefined) delete process.env.XDG_STATE_HOME
  if (saved.compat === undefined) delete process.env.BLACKBIRD_OPENCODE_COMPATIBLE
})

test("finds the service registration under the blackbird state directory", () => {
  process.env.XDG_STATE_HOME = "/state"
  delete process.env.BLACKBIRD_OPENCODE_COMPATIBLE
  expect(fallback()).toBe("/state/blackbird/service.json")
})

test("finds the opencode registration in --opencode-compatible mode", () => {
  process.env.XDG_STATE_HOME = "/state"
  process.env.BLACKBIRD_OPENCODE_COMPATIBLE = "1"
  expect(fallback()).toBe("/state/opencode/service.json")
})
