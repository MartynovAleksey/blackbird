export * as Brand from "./brand"

// blackbird: name used for user-visible paths and config files; "opencode" in --opencode-compatible mode.
// Reads argv as well as the env: bundled builds may evaluate this before the entrypoint shim sets the env,
// and child processes only get the env.
export const compat =
  process.env.BLACKBIRD_OPENCODE_COMPATIBLE === "1" ||
  process.argv.some((arg) => arg === "--opencode-compatible" || arg.startsWith("--opencode-compatible="))
export const name = compat ? "opencode" : "blackbird"

// blackbird: built-in prompts call the agent and its files "opencode"; rename them so the model says it is blackbird
// and edits blackbird.json. URLs, @opencode-ai/* packages, opencode-* plugin names and OPENCODE_* vars stay as is.
export const prompt = (text: string) =>
  compat
    ? text
    : text.replace(/https?:\/\/\S+|(?<![@\w-])(?:opencode|OpenCode)(?![\w-]|\.ai)/g, (m) =>
        m.startsWith("http") ? m : name,
      )

// blackbird: shell command for hints like "Continue blackbird -s <id>"; the binary is always blackbird.
export const command = compat ? "blackbird --opencode-compatible" : "blackbird"
