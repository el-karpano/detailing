/**
 * Вход владельца: email+пароль из D1 (PBKDF2), сессии в KV.
 */

const SCHEMA = `CREATE TABLE IF NOT EXISTS owners (
  email TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  studio_id TEXT NOT NULL,
  name TEXT,
  created_at TEXT
)`

const ITERATIONS = 100000
const SESSION_TTL_SEC = 30 * 24 * 60 * 60

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

function toHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function fromHex(hex) {
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

export async function hashPassword(password, saltHex) {
  const salt = fromHex(saltHex)
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS },
    keyMaterial,
    256,
  )
  return toHex(bits)
}

/** Формат: pbkdf2-sha256$100000$<salt_hex>$<hash_hex> */
export async function makePasswordHash(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const saltHex = toHex(salt)
  const hashHex = await hashPassword(password, saltHex)
  return `pbkdf2-sha256$${ITERATIONS}$${saltHex}$${hashHex}`
}

export async function verifyPassword(password, stored) {
  try {
    const [algo, iterStr, saltHex, hashHex] = String(stored).split('$')
    if (algo !== 'pbkdf2-sha256') return false
    const iterations = Number(iterStr) || ITERATIONS
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveBits'],
    )
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(saltHex), iterations },
      keyMaterial,
      256,
    )
    const calc = toHex(bits)
    if (calc.length !== hashHex.length) return false
    // constant-time-ish compare
    let diff = 0
    for (let i = 0; i < calc.length; i++) diff |= calc.charCodeAt(i) ^ hashHex.charCodeAt(i)
    return diff === 0
  } catch {
    return false
  }
}

function sessionKey(env, token) {
  return `auth:${env.WORKER_NAME || 'detailing-main'}:${token}`
}

export async function createSession(env, owner) {
  const token = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, '')
  const payload = {
    email: owner.email,
    studioId: owner.studio_id,
    name: owner.name || '',
    exp: Date.now() + SESSION_TTL_SEC * 1000,
  }
  await env.VISITS.put(sessionKey(env, token), JSON.stringify(payload), {
    expirationTtl: SESSION_TTL_SEC,
  })
  return { token, ...payload }
}

export async function readSession(env, request) {
  const header = request.headers.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token) return null
  const raw = await env.VISITS.get(sessionKey(env, token))
  if (!raw) return null
  try {
    const s = JSON.parse(raw)
    if (s.exp && s.exp < Date.now()) {
      await env.VISITS.delete(sessionKey(env, token))
      return null
    }
    return { token, ...s }
  } catch {
    return null
  }
}

/** 401 если нет валидной сессии владельца ЭТОЙ студии. */
export async function requireAuth(env, request) {
  const session = await readSession(env, request)
  const expectedStudio = env.STUDIO_ID || ''
  if (!session || (expectedStudio && session.studioId && session.studioId !== expectedStudio)) {
    return { session: null, response: json({ error: 'Нужен вход в кабинет' }, 401) }
  }
  return { session, response: null }
}

export async function handleAuth(request, env, url) {
  if (!env.DB || !env.VISITS) return json({ error: 'DB не настроена' }, 500)
  try {
    await ensureSchema(env)
  } catch (e) {
    return json({ error: 'DB schema: ' + String(e).slice(0, 200) }, 500)
  }

  const p = url.pathname
  const method = request.method

  if (p === '/api/auth/login' && method === 'POST') {
    let body
    try {
      body = await request.json()
    } catch {
      return json({ error: 'bad json' }, 400)
    }
    const email = String(body?.email || '').trim().toLowerCase()
    const password = String(body?.password || '')
    if (!email || !password) return json({ error: 'Укажите почту и пароль' }, 400)

    const { results } = await env.DB.prepare(
      'SELECT email, password_hash, studio_id, name FROM owners WHERE email = ?1',
    )
      .bind(email)
      .all()
    const row = results[0]
    // одинаковая задержка при отсутствии пользователя
    const ok = row ? await verifyPassword(password, row.password_hash) : await verifyPassword(password, 'pbkdf2-sha256$100000$00$00')
    // владелец обязан принадлежать ЭТОЙ студии (не пускать чужие креды между клиентами)
    const expectedStudio = env.STUDIO_ID || ''
    const wrongStudio = row && expectedStudio && row.studio_id !== expectedStudio
    if (!row || !ok || wrongStudio) {
      return json({ error: 'Неверная почта или пароль' }, 401)
    }

    const session = await createSession(env, row)
    return json({
      ok: true,
      token: session.token,
      email: row.email,
      studioId: row.studio_id,
      name: row.name || '',
      exp: session.exp,
    })
  }

  if (p === '/api/auth/logout' && method === 'POST') {
    const session = await readSession(env, request)
    if (session?.token) await env.VISITS.delete(sessionKey(env, session.token))
    return json({ ok: true })
  }

  if (p === '/api/auth/me' && method === 'GET') {
    const session = await readSession(env, request)
    if (!session) return json({ error: 'не авторизован' }, 401)
    return json({
      ok: true,
      email: session.email,
      studioId: session.studioId,
      name: session.name || '',
      exp: session.exp,
    })
  }

  return json({ error: 'method' }, 405)
}
