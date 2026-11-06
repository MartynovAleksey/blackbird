export * as Brand from "./brand.js"

// blackbird: name used for user-visible paths and config files; "opencode" in --opencode-compatible mode.
// Reads argv as well as the env: bundled builds may evaluate this before the entrypoint shim sets the env,
// and child processes only get the env.
export const compat =
  process.env.BLACKBIRD_OPENCODE_COMPATIBLE === "1" ||
  process.argv.some((arg) => arg === "--opencode-compatible" || arg.startsWith("--opencode-compatible="))
export const name = compat ? "opencode" : "blackbird"
