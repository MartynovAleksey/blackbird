import path from "node:path"

// blackbird: BLACKBIRD_* overrides the upstream OPENCODE_* variables read across the codebase.
// Must be the first import of every entrypoint: some modules read process.env at load time.
for (const [key, value] of Object.entries(process.env))
  if (key.startsWith("BLACKBIRD_") && value !== undefined) process.env["OPENCODE_" + key.slice("BLACKBIRD_".length)] = value

// blackbird: --opencode-compatible[=<config-dir>] switches every path back to opencode's (see brand.ts).
// Taken out of argv before the CLI parses it; the env carries it to the background service and children.
const compat = process.argv.findIndex((arg) => arg === "--opencode-compatible" || arg.startsWith("--opencode-compatible="))
if (compat !== -1) {
  const arg = process.argv[compat]
  process.argv.splice(compat, 1)
  process.env.BLACKBIRD_OPENCODE_COMPATIBLE = "1"
  if (arg.includes("=")) process.env.OPENCODE_CONFIG_DIR = path.resolve(arg.slice(arg.indexOf("=") + 1))
}
