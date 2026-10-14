/**
 * Профиль студии на сервере (D1) — фото/цены/контент,
 * чтобы владелец менял их из админки без пересборки.
 */

const SCHEMA = `CREATE TABLE IF NOT EXISTS studio_profile (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at TEXT
)`

let schemaReady = false

async function ensureSchema(env) {
  if (schemaReady) return
  await env.DB.prepare(SCHEMA).run()
  schemaReady = true
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

export async function handleStudio(request, env, url) {
  if (!env.DB) return json({ error: 'DB не настроена' }, 500)
  try {
    await ensureSchema(env)
  } catch (e) {
    return json({ error: 'DB schema: ' + String(e).slice(0, 200) }, 500)
  }

  const method = request.method

  if (method === 'GET') {
    const studio = url.searchParams.get('studio') || 'default'
    const { results } = await env.DB.prepare('SELECT data, updated_at FROM studio_profile WHERE id = ?')
      .bind(studio)
      .all()
    if (!results.length) return json({ studio: null })
    try {
      return json({ studio: JSON.parse(results[0].data), updatedAt: results[0].updated_at })
    } catch {
      return json({ studio: null })
    }
  }

  if (method === 'PUT' || method === 'POST') {
    let body
    try {
      body = await request.json()
    } catch {
      return json({ error: 'bad json' }, 400)
    }
    const studio = body?.studio && typeof body.studio === 'object' ? body.studio : body
    const id = studio?.id || url.searchParams.get('studio') || 'default'
    if (!studio || typeof studio !== 'object') {
      return json({ error: 'missing studio' }, 400)
    }
    const data = JSON.stringify(studio)
    await env.DB.prepare(
      `INSERT INTO studio_profile (id, data, updated_at) VALUES (?1, ?2, ?3)
       ON CONFLICT(id) DO UPDATE SET data = ?2, updated_at = ?3`,
    )
      .bind(id, data, new Date().toISOString())
      .run()
    return json({ ok: true, id })
  }

  return json({ error: 'method' }, 405)
}
