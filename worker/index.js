/**
 * Cloudflare Worker: AI chat, Web Push visits + cron, статика SPA.
 */
import webpush from 'web-push'
import { handleChat } from './chat.js'
import { handleBookings } from './bookings.js'
import { handleMedia } from './media.js'
import { handleStudio } from './studio.js'
import { handleAuth, requireAuth } from './auth.js'

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const p = url.pathname

    if (p === '/api/chat') return handleChat(request, env)
    if (p === '/api/push/public-key' && request.method === 'GET') {
      return json({ publicKey: env.VAPID_PUBLIC_KEY || '' })
    }
    if (p === '/api/visits' && request.method === 'GET') {
      return listVisits(env)
    }
    if (p === '/api/visits' && request.method === 'POST') {
      return saveVisit(request, env)
    }
    // QA: немедленно прогнать dueReminders (cron раз в 15 мин — слишком долго для smoke)
    if (p === '/api/push/flush' && request.method === 'POST') {
      await dueReminders(env)
      return json({ ok: true })
    }
    if (p.startsWith('/api/visits/') && request.method === 'DELETE') {
      const id = p.slice('/api/visits/'.length)
      await env.VISITS.delete(visitKey(env, id))
      return json({ ok: true })
    }
    if (p.startsWith('/api/auth')) {
      return handleAuth(request, env, url)
    }
    if (p === '/api/bookings' || p.startsWith('/api/bookings/')) {
      // GET/POST/PATCH публично (клиент записывается и отменяет).
      // DELETE — только владелец (кабинет).
      if (request.method === 'DELETE') {
        const auth = await requireAuth(env, request)
        if (auth.response) return auth.response
      }
      return handleBookings(request, env, url)
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

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

async function listVisits(env) {
  const prefix = (env.WORKER_NAME || 'detailing-main') + ':'
  const list = await env.VISITS.list({ prefix })
  const items = []
  for (const key of list.keys) {
    const raw = await env.VISITS.get(key.name)
    if (!raw) continue
    try {
      const v = JSON.parse(raw)
      items.push({
        id: v.id,
        serviceName: v.serviceName,
        date: v.date,
        time: v.time,
        visitAt: v.visitAt,
        remind: v.remind,
        sent: v.sent,
        hasSubscription: !!v.subscription?.endpoint,
      })
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

  const visitAt = new Date(`${date}T${time}:00`).getTime()
  if (!Number.isFinite(visitAt)) return json({ error: 'bad date' }, 400)

  const record = {
    id,
    serviceName: serviceName || 'Визит',
    clientName: clientName || '',
    date,
    time,
    visitAt,
    remind: remind !== false,
    sent: false,
    subscription,
    createdAt: Date.now(),
  }
  await env.VISITS.put(visitKey(env, id), JSON.stringify(record))
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
