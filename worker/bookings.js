/**
 * Bookings CRUD on Cloudflare D1.
 * Security:
 *  - GET без auth → только слоты (без PII); с Bearer владельца → полные записи
 *  - POST: валидация + атомарная проверка занятости (INSERT ... WHERE NOT EXISTS)
 *  - PATCH: только владелец; клиент может только отменить СВОЮ запись по clientToken
 *  - DELETE: только владелец
 *  - rate limit на публичные POST
 */
import {
  clampDuration,
  isValidDate,
  isValidTime,
  json,
  newClientToken,
  parseWorkHours,
  rateLimit,
  sanitizeCar,
  sanitizeName,
  sanitizePhone,
  toMin,
  tooMany,
} from './security.js'
import { localToday, studioTz, wallClockToUtcMs } from './time.js'

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  studio_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  service_name TEXT,
  client_name TEXT,
  phone TEXT,
  car TEXT,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  bay INTEGER DEFAULT 1,
  status TEXT DEFAULT 'pending',
  price INTEGER DEFAULT 0,
  paid INTEGER DEFAULT 0,
  created_at TEXT,
  reminder_enabled INTEGER DEFAULT 1,
  duration_min INTEGER DEFAULT 60,
  start_min INTEGER DEFAULT 0,
  client_token TEXT
)`,
  `CREATE INDEX IF NOT EXISTS idx_bookings_studio ON bookings(studio_id, date, time)`,
  `CREATE INDEX IF NOT EXISTS idx_bookings_slot ON bookings(studio_id, bay, date)`,
]

const MIGRATIONS = [
  'ALTER TABLE bookings ADD COLUMN duration_min INTEGER DEFAULT 60',
  'ALTER TABLE bookings ADD COLUMN start_min INTEGER DEFAULT 0',
  'ALTER TABLE bookings ADD COLUMN client_token TEXT',
]

let schemaReady = false

async function ensureSchema(env) {
  if (schemaReady) return
  for (const sql of SCHEMA_STATEMENTS) {
    await env.DB.prepare(sql).run()
  }
  for (const sql of MIGRATIONS) {
    try {
      await env.DB.prepare(sql).run()
    } catch {
      /* column already exists */
    }
  }
  schemaReady = true
}

/** Публичная форма: без PII (имя/телефон/авто/деньги). */
function rowToPublic(r) {
  return {
    id: r.id,
    studioId: r.studio_id,
    serviceId: r.service_id,
    serviceName: r.service_name || '',
    clientName: '',
    phone: '',
    car: '',
    date: r.date,
    time: r.time,
    bay: r.bay ?? 1,
    status: r.status || 'pending',
    price: 0,
    paid: 0,
    createdAt: '',
    reminderEnabled: false,
    durationMin: r.duration_min ?? 60,
  }
}

function rowToFull(r) {
  return {
    id: r.id,
    studioId: r.studio_id,
    serviceId: r.service_id,
    serviceName: r.service_name || '',
    clientName: r.client_name || '',
    phone: r.phone || '',
    car: r.car || '',
    date: r.date,
    time: r.time,
    bay: r.bay ?? 1,
    status: r.status || 'pending',
    price: r.price ?? 0,
    paid: r.paid ?? 0,
    createdAt: r.created_at || '',
    reminderEnabled: !!r.reminder_enabled,
    durationMin: r.duration_min ?? 60,
    clientToken: r.client_token || undefined,
  }
}

function bookingToParams(b, clientToken) {
  const durationMin = clampDuration(b.durationMin)
  const time = String(b.time)
  return {
    id: b.id,
    studio_id: b.studioId || 'default',
    service_id: String(b.serviceId || '').slice(0, 64),
    service_name: sanitizeName(b.serviceName),
    client_name: sanitizeName(b.clientName),
    phone: sanitizePhone(b.phone),
    car: sanitizeCar(b.car),
    date: String(b.date),
    time,
    bay: Number(b.bay) || 1,
    status: b.status || 'pending',
    price: Number(b.price) || 0,
    paid: Number(b.paid) || 0,
    created_at: b.createdAt || new Date().toISOString(),
    reminder_enabled: b.reminderEnabled ? 1 : 0,
    duration_min: durationMin,
    start_min: toMin(time),
    client_token: clientToken || b.clientToken || null,
  }
}

async function loadWorkHours(env) {
  try {
    const row = await env.DB.prepare(
      `SELECT data FROM studio_profile WHERE id = ?1 LIMIT 1`,
    )
      .bind(env.STUDIO_ID || 'default')
      .first()
    if (row?.data) {
      const studio = JSON.parse(row.data)
      if (studio?.workHours) return parseWorkHours(studio.workHours)
    }
  } catch {
    /* no profile table/row */
  }
  return null
}

export async function handleBookings(request, env, url, opts = {}) {
  if (!env.DB) return json({ error: 'DB не настроена' }, 500)
  try {
    await ensureSchema(env)
  } catch (e) {
    console.error('d1 schema', e)
    return json({ error: 'DB schema: ' + String(e).slice(0, 200) }, 500)
  }

  const method = request.method
  const idParam = url.pathname.startsWith('/api/bookings/')
    ? url.pathname.slice('/api/bookings/'.length)
    : ''
  const auth = opts.auth // { session, response } | undefined

  try {
    // ——— GET: публично только слоты, с auth владельца — полные данные ———
    if (method === 'GET' && !idParam) {
      const studio = url.searchParams.get('studio') || 'default'
      const { results } = await env.DB.prepare(
        'SELECT * FROM bookings WHERE studio_id = ? ORDER BY date, time',
      )
        .bind(studio)
        .all()
      const isOwner = !!(auth && auth.session && !auth.response)
      return json({ bookings: results.map(isOwner ? rowToFull : rowToPublic) })
    }

    // ——— POST: создание записи (публично, с rate limit; владелец без лимита) ———
    if (method === 'POST' && !idParam) {
      const isOwner = !!(auth && auth.session && !auth.response)
      if (!isOwner) {
        const rl = await rateLimit(env, 'booking-create', 'ip:' + (opts.ip || 'unknown'), 20, 3600)
        if (!rl.ok) return tooMany(rl.retryAfterSec)
      }

      let body
      try {
        body = await request.json()
      } catch {
        return json({ error: 'bad json' }, 400)
      }

      const studioId = String(body?.studioId || 'default').slice(0, 64)
      const serviceId = String(body?.serviceId || '').slice(0, 64)
      const date = String(body?.date || '')
      const time = String(body?.time || '')
      const clientName = sanitizeName(body?.clientName)
      const phone = sanitizePhone(body?.phone)

      if (!body?.id || !date || !time || !serviceId) {
        return json({ error: 'missing fields' }, 400)
      }
      if (!isValidDate(date) || !isValidTime(time)) {
        return json({ error: 'Некорректные дата или время' }, 400)
      }
      if (!phone || phone.replace(/\D/g, '').length < 6) {
        return json({ error: 'Укажите телефон' }, 400)
      }
      if (!clientName) {
        return json({ error: 'Укажите имя' }, 400)
      }

      // дата не в прошлом — в часовом поясе студии (не UTC!)
      const tz = studioTz(env)
      const todayStr = localToday(tz)
      if (date < todayStr) {
        return json({ error: 'Дата уже прошла' }, 400)
      }

      // длительность: сервер клампит; идеально — из профиля студии
      const durationMin = clampDuration(body?.durationMin)
      const startMin = toMin(time)

      // рабочие часы из профиля студии (если есть)
      const hours = await loadWorkHours(env)
      if (hours && (startMin < hours.open || startMin + durationMin > hours.close)) {
        return json({ error: 'Вне часов работы студии' }, 400)
      }

      // время уже прошло? wall-clock студии → UTC
      const visitAt = wallClockToUtcMs(date, time, tz)
      if (Number.isFinite(visitAt) && visitAt < Date.now() - 60_000) {
        return json({ error: 'Время уже прошло' }, 400)
      }

      const clientToken = newClientToken()
      const p = bookingToParams({ ...body, studioId, serviceId, durationMin }, clientToken)
      const newStart = startMin
      const newEnd = startMin + durationMin + 30

      // Атомарная вставка: только если нет пересечения в этом боксе/дне.
      // Один statement — гонка двух POST решается в SQLite.
      const ins = await env.DB.prepare(
        `INSERT INTO bookings (
           id, studio_id, service_id, service_name, client_name, phone, car,
           date, time, bay, status, price, paid, created_at, reminder_enabled,
           duration_min, start_min, client_token
         )
         SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18
         WHERE NOT EXISTS (
           SELECT 1 FROM bookings
           WHERE studio_id = ?2 AND bay = ?10 AND date = ?8 AND status != 'cancelled'
             AND id != ?1
             AND ?19 < (COALESCE(start_min, 0) + COALESCE(duration_min, 60) + 30)
             AND COALESCE(start_min, 0) < ?20
         )
         ON CONFLICT(id) DO NOTHING`,
      )
        .bind(
          p.id, // ?1
          p.studio_id, // ?2
          p.service_id, // ?3
          p.service_name, // ?4
          p.client_name, // ?5
          p.phone, // ?6
          p.car, // ?7
          p.date, // ?8
          p.time, // ?9
          p.bay, // ?10
          p.status, // ?11
          p.price, // ?12
          p.paid, // ?13
          p.created_at, // ?14
          p.reminder_enabled, // ?15
          p.duration_min, // ?16
          p.start_min, // ?17
          p.client_token, // ?18
          newStart, // ?19 — начало нового интервала (WHERE)
          newEnd, // ?20 — конец нового интервала (WHERE)
        )
        .run()

      const changed = ins?.meta?.changes ?? 0
      if (!changed) {
        // id уже есть → идемпотентность, но НЕ success как «новая запись»
        const existing = await env.DB.prepare('SELECT * FROM bookings WHERE id = ?1')
          .bind(p.id)
          .first()
        if (existing) {
          return json({
            ok: true,
            booking: rowToFull(existing),
            clientToken: existing.client_token,
            deduped: true,
          })
        }
        return json({ error: 'Это время уже занято. Выберите другой слот.' }, 409)
      }

      return json({
        ok: true,
        booking: {
          id: p.id,
          studioId: p.studio_id,
          serviceId: p.service_id,
          serviceName: p.service_name,
          clientName: p.client_name,
          phone: p.phone,
          car: p.car,
          date: p.date,
          time: p.time,
          bay: p.bay,
          status: p.status,
          price: p.price,
          paid: p.paid,
          createdAt: p.created_at,
          reminderEnabled: !!p.reminder_enabled,
          durationMin: p.duration_min,
          clientToken: p.client_token,
        },
        clientToken: p.client_token,
      })
    }

    // ——— PATCH ———
    if (method === 'PATCH' && idParam) {
      let body
      try {
        body = await request.json()
      } catch {
        return json({ error: 'bad json' }, 400)
      }

      const isOwner = !!(auth && auth.session && !auth.response)
      const clientToken = body?.clientToken
      const onlyCancel =
        body?.status === 'cancelled' &&
        Object.keys(body).every((k) => k === 'status' || k === 'clientToken')

      // Не раскрываем существование записи без авторизации/валидного clientToken
      if (!isOwner && !onlyCancel) {
        return json({ error: 'Нужен вход в кабинет' }, 401)
      }

      const existing = await env.DB.prepare('SELECT * FROM bookings WHERE id = ?1')
        .bind(idParam)
        .first()
      if (!existing) return json({ error: 'not found' }, 404)

      if (!isOwner) {
        if (!clientToken || !existing.client_token || clientToken !== existing.client_token) {
          return json({ error: 'Нужен вход в кабинет' }, 401)
        }
        await env.DB.prepare(`UPDATE bookings SET status = 'cancelled' WHERE id = ?1`).bind(idParam).run()
        return json({ ok: true, cancelled: true })
      }

      // Владелец: ограничим список полей
      const sets = []
      const vals = []
      const push = (col, val) => {
        sets.push(`${col} = ?`)
        vals.push(val)
      }
      const allowedStatus = new Set(['pending', 'accepted', 'ready', 'done', 'cancelled'])
      if (body.status !== undefined) {
        if (!allowedStatus.has(body.status)) return json({ error: 'bad status' }, 400)
        push('status', body.status)
      }
      if (body.paid !== undefined) push('paid', Math.max(0, Number(body.paid) || 0))
      if (body.price !== undefined) push('price', Math.max(0, Number(body.price) || 0))
      if (body.date !== undefined) {
        if (!isValidDate(body.date)) return json({ error: 'bad date' }, 400)
        push('date', String(body.date))
      }
      if (body.time !== undefined) {
        if (!isValidTime(body.time)) return json({ error: 'bad time' }, 400)
        push('time', String(body.time))
        push('start_min', toMin(body.time))
      }
      if (body.bay !== undefined) push('bay', Math.max(1, Math.min(20, Number(body.bay) || 1)))
      if (body.clientName !== undefined) push('client_name', sanitizeName(body.clientName))
      if (body.phone !== undefined) push('phone', sanitizePhone(body.phone))
      if (body.car !== undefined) push('car', sanitizeCar(body.car))
      if (body.reminderEnabled !== undefined) push('reminder_enabled', body.reminderEnabled ? 1 : 0)
      if (body.durationMin !== undefined) push('duration_min', clampDuration(body.durationMin))

      if (!sets.length) return json({ ok: true, unchanged: true })
      vals.push(idParam)
      const upd = await env.DB.prepare(`UPDATE bookings SET ${sets.join(', ')} WHERE id = ?`)
        .bind(...vals)
        .run()
      if (!(upd?.meta?.changes > 0)) {
        return json({ error: 'not found' }, 404)
      }
      return json({ ok: true })
    }

    // ——— DELETE: только владелец (index.js уже проверяет auth) ———
    if (method === 'DELETE' && idParam) {
      const del = await env.DB.prepare('DELETE FROM bookings WHERE id = ?').bind(idParam).run()
      if (!(del?.meta?.changes > 0)) {
        return json({ error: 'not found' }, 404)
      }
      return json({ ok: true, deleted: true })
    }

    return json({ error: 'method' }, 405)
  } catch (e) {
    console.error('bookings api', e)
    return json({ error: String(e).slice(0, 300) }, 500)
  }
}
