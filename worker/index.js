/**
 * Cloudflare Worker: AI chat, Web Push visits + cron, статика SPA.
 *
 * Security rules (see also worker/security.js):
 *  - bookings GET: public = slots only; owner Bearer = full PII
 *  - bookings PATCH: owner only; client may cancel own visit via clientToken
 *  - bookings DELETE: owner only
 *  - visits list/flush: owner only
 *  - visits DELETE: clientToken or owner
 *  - rate limits on chat / login / booking create / visits create
 */
import webpush from 'web-push'
import { handleChat } from './chat.js'
import { handleBookings } from './bookings.js'
import { handleMedia } from './media.js'
import { handleStudio } from './studio.js'
import { handleAuth, requireAuth } from './auth.js'
import { clientIp, json, rateLimit, tooMany } from './security.js'

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const p = url.pathname
    const ip = clientIp(request)

    if (p === '/api/chat') {
      const rl = await rateLimit(env, 'chat', 'ip:' + ip, 30, 3600)
      if (!rl.ok) return tooMany(rl.retryAfterSec)
      return handleChat(request, env)
    }

    if (p === '/api/push/public-key' && request.method === 'GET') {
      return json({ publicKey: env.VAPID_PUBLIC_KEY || '' })
    }

    // ——— push-напоминания: служебные операции только для владельца ———
    if (p === '/api/visits' && request.method === 'GET') {
      const auth = await requireAuth(env, request)
      if (auth.response) return auth.response
      return listVisits(env)
    }
    if (p === '/api/visits' && request.method === 'POST') {
      const rl = await rateLimit(env, 'visit-create', 'ip:' + ip, 20, 3600)
      if (!rl.ok) return tooMany(rl.retryAfterSec)
      return saveVisit(request, env)
    }
    if (p === '/api/push/flush' && request.method === 'POST') {
      const auth = await requireAuth(env, request)
      if (auth.response) return auth.response
      await dueReminders(env)
      return json({ ok: true })
    }
    if (p.startsWith('/api/visits/') && request.method === 'DELETE') {
      const id = decodeURIComponent(p.slice('/api/visits/'.length))
      return deleteVisit(request, env, id)
    }

    if (p.startsWith('/api/auth')) {
      return handleAuth(request, env, url)
    }

    if (p === '/api/bookings' || p.startsWith('/api/bookings/')) {
      // DELETE и PATCH (кроме клиентской отмены) — владелец.
      // Сама авторизация внутри handleBookings, чтобы различать cancel по clientToken.
      let auth
      if (request.method !== 'GET' && request.method !== 'POST') {
        auth = await requireAuth(env, request)
        // для PATCH без auth — оставляем 401 на совести handleBookings (clientToken cancel)
        if (request.method === 'DELETE' && auth.response) return auth.response
      } else if (request.method === 'GET') {
        auth = await requireAuth(env, request)
        // не редиректим: public GET отдаёт слоты, owner GET — полные данные
        if (auth.response) auth = { session: null, response: null }
      }
      return handleBookings(request, env, url, { auth, ip })
    }

    if (p === '/api/media' || p.startsWith('/api/media/')) {
      if (request.method !== 'GET') {
        const auth = await requireAuth(env, request)
        if (auth.response) return auth.response
      }
      return handleMedia(request, env, url)
    }
    if (p === '/api/studio') {
      if (request.method !== 'GET') {
        const auth = await requireAuth(env, request)
        if (auth.response) return auth.response
      }
      return handleStudio(request, env, url)
    }

    return env.ASSETS.fetch(request)
  },

  // Cron: раз в 15 минут шлём push за сутки до визита
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(dueReminders(env))
  },
}

function visitKey(env, id) {
  // общий KV на всех клиентов — ключ с префиксом worker'а
  const prefix = (env.WORKER_NAME || 'detailing-main') + ':'
  return prefix + id
}

function visitMeta(v) {
  return {
    id: v.id,
    serviceName: v.serviceName,
    date: v.date,
    time: v.time,
    visitAt: v.visitAt,
    remind: v.remind,
    sent: v.sent,
    hasSubscription: !!v.subscription?.endpoint,
  }
}

async function listVisits(env) {
  const prefix = (env.WORKER_NAME || 'detailing-main') + ':'
  const list = await env.VISITS.list({ prefix })
  const items = []
  for (const key of list.keys) {
    const raw = await env.VISITS.get(key.name)
    if (!raw) continue
    try {
      items.push(visitMeta(JSON.parse(raw)))
    } catch {
      /* skip */
    }
  }
  return json({ visits: items })
}

async function saveVisit(request, env) {
  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'bad json' }, 400)
  }
  const { id, serviceName, date, time, clientName, subscription, remind } = body || {}
  if (!id || !date || !time || !subscription?.endpoint) {
    return json({ error: 'missing fields' }, 400)
  }
  // подписка должна выглядеть как push-endpoint, а не произвольный URL
  const endpoint = String(subscription.endpoint || '')
  if (!/^https:\/\//.test(endpoint) || endpoint.length > 2000) {
    return json({ error: 'bad subscription' }, 400)
  }

  const visitAt = new Date(`${date}T${time}:00`).getTime()
  if (!Number.isFinite(visitAt)) return json({ error: 'bad date' }, 400)

  // клиентский токен — чтобы только этот браузер мог снять своё напоминание
  const deleteToken = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, '').slice(0, 16)

  const record = {
    id: String(id).slice(0, 80),
    serviceName: String(serviceName || 'Визит').slice(0, 120),
    clientName: String(clientName || '').slice(0, 120),
    date,
    time,
    visitAt,
    remind: remind !== false,
    sent: false,
    deleteToken,
    subscription: {
      endpoint,
      keys: subscription.keys || {},
    },
    createdAt: Date.now(),
  }
  await env.VISITS.put(visitKey(env, record.id), JSON.stringify(record))
  return json({ ok: true, deleteToken })
}

/** Удаление напоминания: свой deleteToken или владелец. */
async function deleteVisit(request, env, id) {
  const key = visitKey(env, id)
  const raw = await env.VISITS.get(key)
  if (!raw) return json({ ok: true })

  let v = null
  try {
    v = JSON.parse(raw)
  } catch {
    /* ignore */
  }

  const url = new URL(request.url)
  const token = url.searchParams.get('token') || request.headers.get('x-visit-token') || ''
  const auth = await requireAuth(env, request)
  const isOwner = !!(auth.session && !auth.response)
  const tokenOk = v?.deleteToken && token && token === v.deleteToken

  if (!isOwner && !tokenOk) {
    return json({ error: 'Нужен вход в кабинет' }, 401)
  }

  await env.VISITS.delete(key)
  return json({ ok: true })
}

async function dueReminders(env) {
  if (!env.VISITS || !env.VAPID_PRIVATE_KEY) return

  webpush.setVapidDetails(
    env.VAPID_SUBJECT || 'mailto:admin@deteiling-pro.workers.dev',
    env.VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY,
  )

  const now = Date.now()
  const H24 = 24 * 60 * 60 * 1000
  // ключи только нашей ветки worker'а
  const prefix = (env.WORKER_NAME || 'detailing-main') + ':'
  const list = await env.VISITS.list({ prefix })

  for (const key of list.keys) {
    const raw = await env.VISITS.get(key.name)
    if (!raw) continue
    let v
    try {
      v = JSON.parse(raw)
    } catch {
      continue
    }
    // auth-сессии и media в том же KV — пропускаем «не визиты»
    if (!v || !v.subscription?.endpoint || typeof v.visitAt !== 'number') continue
    if (v.sent || v.remind === false) continue
    if (v.visitAt < now) {
      // визит прошёл — удаляем
      await env.VISITS.delete(key.name)
      continue
    }
    const notifyAt = v.visitAt - H24
    if (now < notifyAt) continue

    const payload = JSON.stringify({
      title: 'Напоминание о визите',
      body: `Завтра «${v.serviceName}» в ${v.time}`,
      tag: `visit-${v.id}`,
      url: `/my`,
    })

    try {
      await webpush.sendNotification(v.subscription, payload, {
        TTL: 60 * 60 * 3, // 3 часа
        urgency: 'high',
      })
      v.sent = true
      await env.VISITS.put(key.name, JSON.stringify(v))
    } catch (e) {
      // 404/410 — подписка мертва, удаляем
      const status = e?.statusCode || e?.status
      if (status === 404 || status === 410) {
        await env.VISITS.delete(key.name)
      } else {
        console.error('push fail', status, String(e).slice(0, 200))
      }
    }
  }
}
