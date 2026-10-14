#!/usr/bin/env node
/**
 * Быстрый старт нового клиента.
 * Использование: npm run new-client -- <slug>
 * Создаёт clients/<slug>/ из шаблона — остаётся заполнить client.json и фото.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const slug = process.argv[2]
if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
  console.error('Использование: npm run new-client -- my-studio')
  console.error('slug: только латиница, цифры и дефис')
  process.exit(1)
}

const src = path.join(root, 'clients', '_template')
const dst = path.join(root, 'clients', slug)
if (fs.existsSync(dst)) {
  console.error(`clients/${slug} уже существует`)
  process.exit(1)
}

fs.cpSync(src, dst, { recursive: true })

// подставить slug в client.json
const jsonPath = path.join(dst, 'client.json')
const cfg = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
cfg.slug = slug
cfg.workerName = `detailing-${slug}`
cfg.brand.name = cfg.brand.name || slug
cfg.brand.shortName = cfg.brand.shortName || slug.slice(0, 3).toUpperCase()
fs.writeFileSync(jsonPath, JSON.stringify(cfg, null, 2) + '\n')

console.log(`new-client: создан clients/${slug}/`)
console.log(`  1. Отредактируй clients/${slug}/client.json (имя, телефон, услуги, цены)`)
console.log(`  2. Положи фото в clients/${slug}/assets/ (logo.svg, logo-header.svg, hero.jpg, ...)`)
console.log(`  3. npm run ship -- ${slug}`)
console.log(`  URL будет: https://detailing-${slug}.deteiling-pro.workers.dev`)
