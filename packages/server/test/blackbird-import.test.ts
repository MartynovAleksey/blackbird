import { afterEach, expect, test } from "bun:test"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { Database } from "bun:sqlite"
import { importOpencode } from "../src/blackbird-import"

const dirs: string[] = []
afterEach(() => dirs.splice(0).forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })))

function tmp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "blackbird-import-"))
  dirs.push(dir)
  return dir
}

function write(file: string, content = "x", mode?: number) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content)
  if (mode !== undefined) fs.chmodSync(file, mode)
}

function database(file: string, input: { migrations: string[]; versions: string[] }) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const db = new Database(file)
  db.run("CREATE TABLE migration (id TEXT PRIMARY KEY, time_completed INTEGER NOT NULL)")
  db.run("CREATE TABLE session (id TEXT PRIMARY KEY, version TEXT NOT NULL)")
  for (const id of input.migrations) db.run("INSERT INTO migration VALUES (?, 0)", [id])
  input.versions.forEach((version, i) => db.run("INSERT INTO session VALUES (?, ?)", [`ses_${i}`, version]))
  db.close()
}

function layout() {
  const root = tmp()
  const from = { config: `${root}/c/opencode`, data: `${root}/d/opencode`, state: `${root}/s/opencode` }
  const to = { config: `${root}/c/blackbird`, data: `${root}/d/blackbird`, state: `${root}/s/blackbird` }
  return { root, from, to }
}

const known = new Set(["m1", "m2"])

test("imports config, data and state under blackbird names and skips runtime files", () => {
  const { from, to } = layout()
  write(`${from.config}/opencode.jsonc`, '{"model":"a/b"}')
  write(`${from.config}/agents/opencode-helper.md`)
  write(`${from.config}/node_modules/x/index.js`)
  write(`${from.config}/service.json`)
  write(`${from.data}/auth.json`, "{}", 0o600)
  write(`${from.data}/log/opencode.log`)
  database(`${from.data}/opencode.db`, { migrations: ["m1"], versions: ["1.19.4", "2.1.4"] })
  write(`${from.data}/opencode.db-wal`, "stale")
  write(`${from.state}/model.json`)
  write(`${from.state}/locks/a`)

  const report = importOpencode({ from, to, migrations: known, major: 2 })

  expect(fs.readFileSync(`${to.config}/blackbird.jsonc`, "utf8")).toBe('{"model":"a/b"}')
  expect(fs.existsSync(`${to.config}/agents/blackbird-helper.md`)).toBe(true)
  expect(fs.statSync(`${to.data}/auth.json`).mode & 0o777).toBe(0o600)
  expect(fs.existsSync(`${to.state}/model.json`)).toBe(true)
  for (const file of [`${to.config}/node_modules`, `${to.config}/service.json`, `${to.data}/log`, `${to.state}/locks`])
    expect(fs.existsSync(file)).toBe(false)
  expect(fs.existsSync(`${to.data}/blackbird.db-wal`)).toBe(false)
  const db = new Database(`${to.data}/blackbird.db`, { readonly: true })
  expect(db.query("SELECT count(*) AS n FROM session").get()).toEqual({ n: 2 })
  db.close()
  expect(report.backups).toEqual([])
  expect(fs.existsSync(`${from.config}/opencode.jsonc`)).toBe(true)
})

test("backs up existing files, including the old database journal", () => {
  const { from, to } = layout()
  write(`${from.config}/opencode.json`, "new")
  database(`${from.data}/opencode.db`, { migrations: ["m1"], versions: ["2.2.5"] })
  write(`${to.config}/blackbird.json`, "old")
  write(`${to.config}/blackbird.json.bak`, "older")
  write(`${to.data}/blackbird.db`, "olddb")
  write(`${to.data}/blackbird.db-wal`, "oldwal")

  const report = importOpencode({ from, to, migrations: known, major: 2 })

  expect(fs.readFileSync(`${to.config}/blackbird.json`, "utf8")).toBe("new")
  expect(fs.readFileSync(`${to.config}/blackbird.json.bak.1`, "utf8")).toBe("old")
  expect(fs.readFileSync(`${to.data}/blackbird.db.bak`, "utf8")).toBe("olddb")
  expect(fs.readFileSync(`${to.data}/blackbird.db-wal.bak`, "utf8")).toBe("oldwal")
  expect(fs.existsSync(`${to.data}/blackbird.db-wal`)).toBe(false)
  expect(report.backups).toHaveLength(3)
})

test("skips a database with unknown migrations or a newer major version", () => {
  for (const input of [
    { migrations: ["m1", "m9"], versions: ["2.0.0"], reason: "миграций" },
    { migrations: ["m1"], versions: ["2.2.5", "3.0.1"], reason: "3.0.1" },
  ]) {
    const { from, to } = layout()
    write(`${from.config}/opencode.json`)
    database(`${from.data}/opencode.db`, input)

    const report = importOpencode({ from, to, migrations: known, major: 2 })

    expect(fs.existsSync(`${to.data}/blackbird.db`)).toBe(false)
    expect(fs.existsSync(`${to.config}/blackbird.json`)).toBe(true)
    expect(report.skipped.find((item) => item.path.endsWith("opencode.db"))?.reason).toContain(input.reason)
  }
})

test("imports a path next to itself", () => {
  const root = tmp()
  write(`${root}/opencode.json`, "project")
  write(`${root}/.opencode/agents/a.md`)
  write(`${root}/.opencode/opencode.jsonc`)
  write(`${root}/cfg/opencode.json`, "custom")
  write(`${root}/cfg/agents/b.md`)

  importOpencode({ path: `${root}/opencode.json` })
  importOpencode({ path: `${root}/.opencode` })
  importOpencode({ path: `${root}/cfg` })

  expect(fs.readFileSync(`${root}/blackbird.json`, "utf8")).toBe("project")
  expect(fs.existsSync(`${root}/.blackbird/agents/a.md`)).toBe(true)
  expect(fs.existsSync(`${root}/.blackbird/blackbird.jsonc`)).toBe(true)
  expect(fs.readFileSync(`${root}/cfg/blackbird.json`, "utf8")).toBe("custom")
  expect(fs.existsSync(`${root}/cfg/agents/b.md`)).toBe(true)
  expect(() => importOpencode({ path: `${root}/missing.json` })).toThrow("путь не найден")
})
