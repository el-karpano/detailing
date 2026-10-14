/**
 * Медиа-файлы студии (фото/логотип) в KV.
 * R2 на аккаунте не включён — используем VISITS KV с префиксом media:{WORKER_NAME}:.
 */

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const MAX_BYTES = 2 * 1024 * 1024

function mediaPrefix(env) {
  return `media:${env.WORKER_NAME || 'detailing-main'}:`
}

function mediaKey(env, id) {
  return mediaPrefix(env) + id
}

export async function handleMedia(request, env, url) {
  if (!env.VISITS) return json({ error: 'KV не настроена' }, 500)

  const method = request.method
  const rest = url.pathname.slice('/api/media'.length)
  const id = rest.startsWith('/') ? rest.slice(1) : rest

  // POST /api/media — загрузка (raw body с Content-Type)
  if (method === 'POST' && !id) {
    const contentType = (request.headers.get('content-type') || '').split(';')[0].trim()
    if (!ALLOWED.has(contentType)) {
      return json({ error: 'Нужна картинка: JPG, PNG, WebP или GIF' }, 400)
    }
    const buf = await request.arrayBuffer()
    if (!buf.byteLength) return json({ error: 'Пустой файл' }, 400)
    if (buf.byteLength > MAX_BYTES) {
      return json({ error: 'Фото больше 2 МБ — уменьшите размер' }, 413)
    }
    const newId = crypto.randomUUID()
    await env.VISITS.put(mediaKey(env, newId), buf, {
      metadata: { contentType, size: buf.byteLength, createdAt: Date.now() },
    })
    return json({
      ok: true,
      id: newId,
      url: `/api/media/${newId}`,
      contentType,
      size: buf.byteLength,
    })
  }

  // GET /api/media/:id — отдать картинку
  if (method === 'GET' && id) {
    const entry = await env.VISITS.getWithMetadata(mediaKey(env, id), 'arrayBuffer')
    if (!entry.value) return json({ error: 'not found' }, 404)
    const type = entry.metadata?.contentType || 'image/jpeg'
    return new Response(entry.value, {
      headers: {
        'Content-Type': type,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  }

  // DELETE /api/media/:id
  if (method === 'DELETE' && id) {
    await env.VISITS.delete(mediaKey(env, id))
    return json({ ok: true })
  }

  return json({ error: 'method' }, 405)
}
