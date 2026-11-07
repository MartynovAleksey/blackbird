import { expect, test } from "bun:test"
import { Brand } from "../src/brand"

test("prompt renames the agent and its files but keeps urls, packages and env vars", () => {
  expect(
    Brand.prompt(
      'You are OpenCode. Edit opencode.json or ~/.config/opencode/, run `opencode mcp add`, see https://opencode.ai/config.json and https://github.com/anomalyco/opencode. Keep "@opencode-ai/plugin", "opencode-foo@1.2.3", OPENCODE_CONFIG, opencode.ai and customize-opencode.',
    ),
  ).toBe(
    'You are blackbird. Edit blackbird.json or ~/.config/blackbird/, run `blackbird mcp add`, see https://opencode.ai/config.json and https://github.com/anomalyco/opencode. Keep "@opencode-ai/plugin", "opencode-foo@1.2.3", OPENCODE_CONFIG, opencode.ai and customize-opencode.',
  )
})
