// blackbird: BLACKBIRD_* overrides the upstream OPENCODE_* variables read across the codebase.
// Must be the first import of every entrypoint: some modules read process.env at load time.
for (const [key, value] of Object.entries(process.env))
  if (key.startsWith("BLACKBIRD_") && value !== undefined) process.env["OPENCODE_" + key.slice("BLACKBIRD_".length)] = value
