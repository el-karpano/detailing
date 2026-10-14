#!/usr/bin/env node
/**
 * Заносит владельца в D1 (PBKDF2-хеш пароля).
 * Использование: node scripts/seed-owner.mjs <slug> <email> <password> [name]
 * Пример:        node scripts/seed-owner.mjs hvv owner@hvv.by 'Strong#Pass1' 'ХВВ'
 */
import { spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const [slug, email, password, name] = process.argv.slice(2)

if (!slug || !email || !password) {
  console.error('Использование: node scripts/seed-owner.mjs <slug> <email> <password> [name]')
  process.exit(1)
}

const ITERATIONS = 100000
const salt = crypto.randomBytes(16)
const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, 32, 'sha256')
const passwordHash = `pbkdf2-sha256$${ITERATIONS}$${salt.toString('hex')}$${hash.toString('hex')}`

// БД берём из clients/<slug>/client.json (своя D1 на клиента), не из «чужого» wrangler.toml
const clientJsonPath = path.join(root, 'clients', slug, 'client.json')
let clientCfg = {}
if (fs.existsSync(clientJsonPath)) {
  clientCfg = JSON.parse(fs.readFileSync(clientJsonPath, 'utf8'))
}
const workerName = clientCfg.workerName || `detailing-${slug}`
const dbName = clientCfg.databaseName || `${workerName}-db`
const dbId = clientCfg.databaseId || ''
const studioId = `studio-${slug}`

if (!dbName && !dbId) {
  console.error('seed-owner: нет databaseName/databaseId в clients/' + slug + '/client.json')
  process.exit(1)
}

const emailLc = email.trim().toLowerCase()
const esc = (s) => String(s).replace(/'/g, "''")
const sql = `CREATE TABLE IF NOT EXISTS owners (
  email TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  studio_id TEXT NOT NULL,
  name TEXT,
  created_at TEXT
);
INSERT INTO owners (email, password_hash, studio_id, name, created_at)
VALUES ('${esc(emailLc)}', '${esc(passwordHash)}', '${esc(studioId)}', '${esc(name || emailLc)}', '${new Date().toISOString()}')
ON CONFLICT(email) DO UPDATE SET password_hash = '${esc(passwordHash)}', studio_id = '${esc(studioId)}', name = '${esc(name || emailLc)}';`

const sqlFile = path.join(root, '.seed-owner.tmp.sql')
fs.writeFileSync(sqlFile, sql + '\n', 'utf8')

console.log(`seed-owner: ${emailLc} → ${dbName || dbId} / ${studioId}`)

const res = spawnSync(
  'npx',
  ['wrangler', 'd1', 'execute', dbId || dbName, '--remote', '--file', sqlFile],
  {
    cwd: root,
    encoding: 'utf8',
    shell: true,
  },
)
const out = `${res.stdout || ''}\n${res.stderr || ''}`
fs.rmSync(sqlFile, { force: true })
if (res.status !== 0) {
  console.error(out.slice(-1500))
  process.exit(res.status ?? 1)
}
console.log(out.trim().split('\n').slice(-6).join('\n'))

console.log(`seed-owner: готово → ${dbName || dbId} / ${studioId}. Пароль НЕ хранится в git (только хеш в D1).`)
