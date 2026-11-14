import { execFile } from "node:child_process"
import path from "node:path"
import { promisify } from "node:util"
import { app, BrowserWindow, dialog } from "electron"
import { opencodeCompatible, setOpencodeCompatible } from "./blackbird-settings"
import type { MenubarEntry } from "./native/menu"
import { nativeT } from "./native/translations"

// blackbird: Desktop counterparts of the CLI's --opencode-compatible and --opencode-import.
const execFileAsync = promisify(execFile)

/** App menu items placed after "Install CLI…". */
export function opencodeMenu(relaunch: () => void): MenubarEntry[] {
  return [
    {
      menu: "app",
      id: "blackbird.opencodeImport",
      label: nativeT("desktop.menu.opencodeImport"),
      after: "app.installCli",
      enabled: () => app.isPackaged,
      run: () => void importOpencode(relaunch),
    },
    {
      menu: "app",
      id: "blackbird.opencodeCompatible",
      label: nativeT("desktop.menu.opencodeCompatible"),
      after: "blackbird.opencodeImport",
      checked: opencodeCompatible,
      enabled: () => true,
      run: () => void toggleCompatible(relaunch),
    },
  ]
}

async function importOpencode(relaunch: () => void) {
  if (!(await confirm(nativeT("desktop.opencodeImport.confirm"), nativeT("desktop.opencodeImport.run")))) return
  // The service holds blackbird.db open; the import replaces it, so the service stops first.
  await stopService()
  // shortcut: packaged builds only; an unpackaged dev run has no bundled CLI next to the app.
  const cli = path.join(process.resourcesPath, process.platform === "win32" ? "opencode-cli.exe" : "opencode-cli")
  const env = { ...process.env }
  delete env.BLACKBIRD_OPENCODE_COMPATIBLE
  const result = await execFileAsync(cli, ["--opencode-import"], { env, windowsHide: true }).then(
    (output) => ({ ok: true, text: output.stdout.trim() }),
    (error: { stdout?: string; stderr?: string; message: string }) => ({
      ok: false,
      text: (error.stderr || error.stdout || error.message).trim(),
    }),
  )
  await dialog.showMessageBox({
    type: result.ok ? "info" : "error",
    message: nativeT(result.ok ? "desktop.opencodeImport.done" : "desktop.opencodeImport.failed"),
    detail: result.text,
  })
  relaunch()
}

async function toggleCompatible(relaunch: () => void) {
  const next = !opencodeCompatible()
  const message = nativeT(next ? "desktop.opencodeCompatible.confirmOn" : "desktop.opencodeCompatible.confirmOff")
  if (!(await confirm(message, nativeT("desktop.opencodeCompatible.restart")))) return
  // The other mode's service binds the same port, so the current one stops before the relaunch.
  await stopService()
  setOpencodeCompatible(next)
  relaunch()
}

async function confirm(message: string, action: string) {
  const result = await dialog.showMessageBox({
    type: "question",
    message,
    buttons: [action, nativeT("desktop.opencodeImport.cancel")],
    defaultId: 0,
    cancelId: 1,
  })
  return result.response === 0
}

async function stopService() {
  // A window that loses the service reconnects and starts a new one, so the pages unload first.
  await Promise.all(BrowserWindow.getAllWindows().map((win) => win.webContents.loadURL("about:blank")))
  const { Service } = await import("@opencode/client/service")
  await Service.stop().catch((error) => console.error("blackbird: failed to stop the background service", error))
}
