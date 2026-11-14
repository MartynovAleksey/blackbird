import { readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { app } from "electron"

// blackbird: Desktop-only settings, kept apart from upstream's stores so the entry module can read them before ready.
const file = () => path.join(app.getPath("userData"), "blackbird.json")

export function opencodeCompatible() {
  try {
    return JSON.parse(readFileSync(file(), "utf8")).opencodeCompatible === true
  } catch {
    return false
  }
}

export function setOpencodeCompatible(value: boolean) {
  writeFileSync(file(), JSON.stringify({ opencodeCompatible: value }))
}

/** Runs once userData is set and before anything finds or starts the service: both read this env. */
export function applyOpencodeCompatible() {
  // app.relaunch() passes this process's env on, so turning the mode off must clear it too.
  if (opencodeCompatible()) process.env.BLACKBIRD_OPENCODE_COMPATIBLE = "1"
  else delete process.env.BLACKBIRD_OPENCODE_COMPATIBLE
}
