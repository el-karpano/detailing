#!/usr/bin/env node
/**
 * Сборка и деплой клиента на бесплатный субдомен Cloudflare Workers.
 * Использование: node scripts/ship.mjs <slug>
 * Или: npm run ship -- <slug>
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const slug = process.argv[2] || process.env.CLIENT

if (!slug) {
  console.error('Использование: npm run ship -- <slug>')
  console.error('Пример:       npm run ship -- sgx')
  process.exit(1)
}

function run(cmd, args, opts = {}) {
  const pretty = `${cmd} ${args.join(' ')}`
  console.log(`\n$ ${pretty}`)
  const res = spawnSync(pretty, {
    cwd: root,
    stdio: 'inherit',
    shell: true,
    ...opts,
  })
  if (res.status !== 0) {
    console.error(`ship: команда упала (${cmd}), exit ${res.status}`)
    process.exit(res.status ?? 1)
  }
}

// 1. Подставить данные клиента
run('node', ['scripts/prepare-client.mjs', slug])

// 2. Создать D1-базу клиента, если ещё нет (своя БД + свой uuid на каждого)
{
  const clientJsonPath = path.join(root, 'clients', slug, 'client.json')
  const clientCfg = JSON.parse(fs.readFileSync(clientJsonPath, 'utf8'))
  const wranglerPre = fs.readFileSync(path.join(root, 'wrangler.toml'), 'utf8')
  const dbName = wranglerPre.match(/database_name = "(.+)"/)?.[1]
  let dbId = wranglerPre.match(/database_id = "(.+)"/)?.[1]
  if (dbName && (!dbId || dbId === 'REPLACE_BY_SHIP')) {
    console.log(`\nship: создаю D1-базу ${dbName}`)
    const created = spawnSync(`npx wrangler d1 create ${dbName}`, {
      cwd: root,
      stdio: ['inherit', 'pipe', 'pipe'],
      encoding: 'utf-8',
      shell: true,
    })
    const out = `${created.stdout || ''}\n${created.stderr || ''}`
    const newId = out.match(/database_id\s*=\s*"([^"]+)"/)?.[1]
    if (newId) {
      dbId = newId
      let w = fs.readFileSync(path.join(root, 'wrangler.toml'), 'utf8')
      w = w.replace(/database_id = ".*"/, `database_id = "${newId}"`)
      fs.writeFileSync(path.join(root, 'wrangler.toml'), w)
      // сохраняем uuid в client.json — иначе следующий prepare сотрёт привязку
      clientCfg.databaseName = dbName
      clientCfg.databaseId = newId
      fs.writeFileSync(clientJsonPath, JSON.stringify(clientCfg, null, 2) + '\n')
      console.log(`ship: D1 database_id=${newId} → clients/${slug}/client.json`)
    } else {
      console.error('ship: не удалось создать D1 — логи:\n', out.slice(-800))
      process.exit(1)
    }
  } else if (dbId && clientCfg.databaseId !== dbId) {
    clientCfg.databaseName = dbName
    clientCfg.databaseId = dbId
    fs.writeFileSync(clientJsonPath, JSON.stringify(clientCfg, null, 2) + '\n')
    console.log(`ship: зафиксировал D1 ${dbName} (${dbId}) в clients/${slug}/client.json`)
  }
}

// 3. Собрать
run('npm', ['run', 'build'])

// 3. Удалить dist/_redirects (иначе Cloudflare 100324 Infinite loop)
const redirects = path.join(root, 'dist', '_redirects')
if (fs.existsSync(redirects)) {
  fs.rmSync(redirects)
  console.log('ship: удалил dist/_redirects')
}

// 4. Прочитать имя worker из wrangler.toml
const wrangler = fs.readFileSync(path.join(root, 'wrangler.toml'), 'utf8')
const workerName = wrangler.match(/^name = "(.+)"$/m)?.[1]
if (!workerName) {
  console.error('ship: не удалось прочитать name из wrangler.toml')
  process.exit(1)
}

// 5. Деплой
run('npx', ['wrangler', 'deploy'])

// 6. Секреты (MIMO + VAPID) — только недостающие, чтобы не тормозить каждый ship
const envPath = path.join(root, '.env')
function readEnv(key) {
  if (!fs.existsSync(envPath)) return null
  const envText = fs.readFileSync(envPath, 'utf8')
  return envText.match(new RegExp(`^${key}=(.+)$`, 'm'))?.[1]?.trim() || null
}

const secrets = {
  MIMO_API_KEY: readEnv('MIMO_API_KEY'),
  VAPID_PUBLIC_KEY: readEnv('VAPID_PUBLIC_KEY'),
  VAPID_PRIVATE_KEY: readEnv('VAPID_PRIVATE_KEY'),
  VAPID_SUBJECT: readEnv('VAPID_SUBJECT'),
}

let existing = new Set()
try {
  const ls = spawnSync('npx wrangler secret list', {
    cwd: root,
    encoding: 'utf-8',
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  for (const name of Object.keys(secrets)) {
    if (`${ls.stdout}`.includes(name)) existing.add(name)
  }
} catch {
  /* list может упасть — тогда перезальём всё */
}

for (const [name, value] of Object.entries(secrets)) {
  if (!value) {
    console.log(`ship: в .env нет ${name}`)
    continue
  }
  if (existing.has(name)) {
    console.log(`ship: secret ${name} уже есть`)
    continue
  }
  console.log(`\nship: записываю secret ${name}`)
  const res = spawnSync(`npx wrangler secret put ${name}`, {
    cwd: root,
    stdio: ['pipe', 'inherit', 'inherit'],
    shell: true,
    input: value + '\n',
  })
  if (res.status !== 0) {
    console.error(`ship: не удалось записать secret ${name}`)
  }
}

const url = `https://${workerName}.deteiling-pro.workers.dev`
console.log(`\nship: клиент «${slug}» задеплоен`)
console.log(`  URL: ${url}`)
