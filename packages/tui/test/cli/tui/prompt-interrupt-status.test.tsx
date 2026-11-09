/** @jsxImportSource @opentui/solid */
import { RGBA } from "@opentui/core"
import { testRender } from "@opentui/solid"
import { expect, test } from "bun:test"
import { PromptInterruptStatus } from "../../../src/component/prompt"

test("armed interrupt status renders visible warning text", async () => {
  const text = RGBA.fromHex("#ffffff")
  const subdued = RGBA.fromHex("#808080")
  const warning = RGBA.fromHex("#fbbf24")
  const app = await testRender(() => <PromptInterruptStatus armed text={text} subdued={subdued} warning={warning} />, {
    width: 30,
    height: 1,
  })

  try {
    await app.renderOnce()
    const line = app.renderer.currentRenderBuffer.getSpanLines()[0]!

    expect(line.spans.map((span) => span.text).join("")).toContain("esc again to interrupt")
    expect(line.spans.filter((span) => span.text.trim()).every((span) => span.fg.equals(warning))).toBeTrue()
  } finally {
    app.renderer.destroy()
  }
})

test.each([
  [undefined, false, "esc interrupt"],
  [undefined, true, "esc again to interrupt"],
  ["", false, "esc interrupt"],
  ["ctrl+esc", false, "ctrl+esc interrupt"],
  ["ctrl+esc", true, "ctrl+esc again to interrupt"],
])("interrupt hint %p armed=%p renders %p", async (hint, armed, expected) => {
  const color = RGBA.fromHex("#ffffff")
  const app = await testRender(
    () => <PromptInterruptStatus armed={armed} hint={hint} text={color} subdued={color} warning={color} />,
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
