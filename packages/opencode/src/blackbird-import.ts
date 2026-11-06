// blackbird: `blackbird --opencode-import [path]` copies opencode's files under blackbird's names and exits.
// Second import of the entrypoint (after blackbird-env): it runs before the CLI and never reaches it.
import fs from "node:fs"
import path from "node:path"
import { Database } from "bun:sqlite"
import os from "node:os"
import { migrations } from "@opencode-ai/core/database/migration.gen"

// Line major for the database version check; dev builds report 0.0.0-*, so it is not read from the version.
const LINE_MAJOR = 1
// Rebuildable or owned by a running opencode: dependencies, logs, locks, the service registration and port.
const SKIP = new Set(["node_modules", "log", "locks", "service.json"])

export type Report = {
  copied: string[]
  backups: string[]
  skipped: { path: string; reason: string }[]
}

export type Options = {
  /** File or directory to import next to itself; omitted for opencode's global config, data and state. */
  path?: string
  from?: Record<"config" | "data" | "state", string>
  to?: Record<"config" | "data" | "state", string>
  migrations?: ReadonlySet<string>
  major?: number
}

// XDG roots the same way the global paths are built (core/src/global.ts), for any app name.
function roots(app: string) {
  const home = os.homedir()
  return {
    config: path.join(process.env.XDG_CONFIG_HOME || path.join(home, ".config"), app),
    data: path.join(process.env.XDG_DATA_HOME || path.join(home, ".local", "share"), app),
    state: path.join(process.env.XDG_STATE_HOME || path.join(home, ".local", "state"), app),
  }
}

const rename = (name: string) => name.replaceAll("opencode", "blackbird")
const exists = (file: string) => fs.lstatSync(file, { throwIfNoEntry: false }) !== undefined
const isDatabase = (name: string) => /^opencode(-.+)?\.db$/.test(name)

export function importOpencode(options: Options = {}): Report {
  const report: Report = { copied: [], backups: [], skipped: [] }
  const known = options.migrations ?? new Set(migrations.map((item) => item.id))
  const major = options.major ?? LINE_MAJOR

  const backup = (file: string) => {
    if (!exists(file)) return
    let target = `${file}.bak`
    for (let i = 1; exists(target); i++) target = `${file}.bak.${i}`
    fs.renameSync(file, target)
    report.backups.push(target)
  }

  const copyDatabase = (src: string, dst: string) => {
    const db = new Database(src, { readonly: true })
    try {
      const tables = new Set(
        db.query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name),
      )
      const ids = tables.has("migration")
        ? db.query<{ id: string }, []>("SELECT id FROM migration").all().map((row) => row.id)
        : []
      const unknown = ids.filter((id) => !known.has(id))
      if (unknown.length > 0)
        return report.skipped.push({
          path: src,
          reason: `схема базы новее этой сборки: ${unknown.length} неизвестных миграций (${unknown.toSorted().at(-1)})`,
        })
      const versions = ["session", "session_v2"]
        .filter((table) => tables.has(table))
        .flatMap((table) => db.query<{ version: string }, []>(`SELECT DISTINCT version FROM ${table}`).all())
        .map((row) => row.version)
      const newest = versions.toSorted((a, b) => (Number.parseInt(a) || 0) - (Number.parseInt(b) || 0)).at(-1)
      if (newest !== undefined && (Number.parseInt(newest) || 0) > major)
        return report.skipped.push({
          path: src,
          reason: `в базу писал opencode ${newest}, а это blackbird линии ${major}.x`,
        })
      // A stale WAL next to the new file would be replayed onto it, so the old journal goes to backup too.
      for (const file of [dst, `${dst}-wal`, `${dst}-shm`]) backup(file)
      fs.mkdirSync(path.dirname(dst), { recursive: true })
      // VACUUM INTO takes a consistent snapshot even while opencode holds the database open in WAL mode.
      db.run(`VACUUM INTO '${dst.replaceAll("'", "''")}'`)
      fs.chmodSync(dst, fs.statSync(src).mode & 0o777)
      report.copied.push(dst)
    } finally {
      db.close()
    }
  }

  const copy = (src: string, dst: string) => {
    const name = path.basename(src)
    if (SKIP.has(name)) return report.skipped.push({ path: src, reason: "не переносится" })
    const stat = fs.lstatSync(src)
    if (stat.isDirectory()) {
      if (exists(dst) && !fs.lstatSync(dst).isDirectory()) backup(dst)
      fs.mkdirSync(dst, { recursive: true })
      for (const entry of fs.readdirSync(src)) {
        if (/^opencode(-.+)?\.db-(wal|shm)$/.test(entry)) continue
        copy(path.join(src, entry), path.join(dst, rename(entry)))
      }
      return
    }
    if (isDatabase(name)) return copyDatabase(src, dst)
    backup(dst)
    if (stat.isSymbolicLink()) fs.symlinkSync(fs.readlinkSync(src), dst)
    else {
      fs.copyFileSync(src, dst)
      fs.chmodSync(dst, stat.mode & 0o777)
    }
    report.copied.push(dst)
  }

  // Directory without "opencode" in its own name: import only the entries that carry it, next to them.
  const inPlace = (dir: string) => {
    for (const entry of fs.readdirSync(dir)) {
      const src = path.join(dir, entry)
      if (entry.includes("opencode")) copy(src, path.join(dir, rename(entry)))
      else if (fs.lstatSync(src).isDirectory() && !SKIP.has(entry)) inPlace(src)
    }
  }

  if (options.path !== undefined) {
    const src = path.resolve(options.path)
    if (!exists(src)) throw new Error(`путь не найден: ${src}`)
    const name = path.basename(src)
    if (name.includes("opencode")) copy(src, path.join(path.dirname(src), rename(name)))
    else if (fs.lstatSync(src).isDirectory()) inPlace(src)
    else throw new Error(`в имени ${src} нет "opencode": нечего импортировать`)
    return report
  }

  const from = options.from ?? roots("opencode")
  const to = options.to ?? roots("blackbird")
  for (const kind of ["config", "data", "state"] as const) {
    if (exists(from[kind])) copy(from[kind], to[kind])
    else report.skipped.push({ path: from[kind], reason: "нет такого каталога" })
  }
  return report
}

const flag = process.argv.indexOf("--opencode-import")
if (flag !== -1) {
  const arg = process.argv[flag + 1]
  try {
    const report = importOpencode({ path: arg && !arg.startsWith("-") ? arg : undefined })
    console.log(`Скопировано: ${report.copied.length}`)
    for (const file of report.backups) console.log(`Бэкап: ${file}`)
    for (const item of report.skipped) console.log(`Пропущено: ${item.path} — ${item.reason}`)
    process.exit(0)
  } catch (error) {
    console.error(`blackbird --opencode-import: ${error instanceof Error ? error.message : error}`)
    process.exit(1)
  }
}
