/**
 * Shared security helpers: rate limits (KV), request validation, client tokens.
 * Used by all white-label workers via env.VISITS + env.WORKER_NAME.
 */

export function json(obj, status = 200, headers = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  })
}

export function clientIp(request) {
  return (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  )
}

/**
 * Fixed-window rate limit in KV. Returns { ok, retryAfterSec }.
 * Key namespace is per-worker so clients don't share budgets.
 */
export async function rateLimit(env, bucket, id, limit, windowSec) {
  if (!env.VISITS) return { ok: true, retryAfterSec: 0 }
  const key = `rl:${env.WORKER_NAME || 'default'}:${bucket}:${id}`
  const now = Date.now()
  let data = { count: 0, resetAt: now + windowSec * 1000 }
  try {
    const raw = await env.VISITS.get(key)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && parsed.resetAt > now) data = parsed
    }
  } catch {
    /* treat as empty */
  }
  if (data.count >= limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((data.resetAt - now) / 1000)) }
  }
  data.count += 1
  const ttl = Math.max(30, Math.ceil((data.resetAt - now) / 1000))
  await env.VISITS.put(key, JSON.stringify(data), { expirationTtl: ttl })
  return { ok: true, retryAfterSec: 0 }
}

export function tooMany(retryAfterSec = 60) {
  return json({ error: 'Слишком много запросов. Попробуйте позже.' }, 429, {
    'Retry-After': String(retryAfterSec),
  })
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

export function isValidDate(s) {
  if (!DATE_RE.test(String(s || ''))) return false
  const d = new Date(`${s}T00:00:00Z`)
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s
}

export function isValidTime(s) {
  return TIME_RE.test(String(s || ''))
}

export function toMin(t) {
  const [h, m] = String(t).split(':').map(Number)
  return h * 60 + m
}

/** "09:00–20:00" → { open: 540, close: 1200 } or null */
export function parseWorkHours(workHours) {
  const m = String(workHours || '').match(/(\d{1,2}:\d{2})\s*[–—-]\s*(\d{1,2}:\d{2})/)
  if (!m) return null
  return { open: toMin(m[1]), close: toMin(m[2]) }
}

export function clampDuration(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return 60
  return Math.min(480, Math.max(15, Math.round(v)))
}

export function newClientToken() {
  return crypto.randomUUID() + crypto.randomUUID().replace(/-/g, '').slice(0, 16)
}

export function sanitizeName(s) {
  return String(s || '').replace(/\s+/g, ' ').trim().slice(0, 120)
}

export function sanitizePhone(s) {
  return String(s || '').replace(/[^\d+\-() ]/g, '').trim().slice(0, 32)
}

export function sanitizeCar(s) {
  return String(s || '').replace(/\s+/g, ' ').trim().slice(0, 120)
}
