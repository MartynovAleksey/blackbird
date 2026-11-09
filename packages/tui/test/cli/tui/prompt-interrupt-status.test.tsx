/** @jsxImportSource @opentui/solid */
import { RGBA } from "@opentui/core"
import { testRender } from "@opentui/solid"
import { expect, test } from "bun:test"
import { PromptInterruptStatus } from "../../../src/component/prompt"

test.each([
  [undefined, false, "esc interrupt"],
  [undefined, true, "esc again to interrupt"],
  ["", false, "esc interrupt"],
  ["ctrl+esc", false, "ctrl+esc interrupt"],
  ["ctrl+esc", true, "ctrl+esc again to interrupt"],
])("interrupt hint %p armed=%p renders %p", async (hint, armed, expected) => {
  const color = RGBA.fromHex("#ffffff")
  const app = await testRender(
    () => <PromptInterruptStatus armed={armed} hint={hint} text={color} subdued={color} primary={color} />,
    { width: 40, height: 1 },
  )

  try {
    await app.renderOnce()
    expect(app.renderer.currentRenderBuffer.getSpanLines()[0]!.spans.map((span) => span.text).join("").trim()).toBe(
      expected,
    )
  } finally {
    app.renderer.destroy()
  }
})
