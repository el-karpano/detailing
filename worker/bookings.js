/**
 * Bookings CRUD on Cloudflare D1.
 * У каждого клиента (Worker) — своя D1-база, binding env.DB.
 */

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
  reminder_enabled INTEGER DEFAULT 1
)`,
  `CREATE INDEX IF NOT EXISTS idx_bookings_studio ON bookings(studio_id, date, time)`,
]

let schemaReady = false

async function ensureSchema(env) {
  if (schemaReady) return
  for (const sql of SCHEMA_STATEMENTS) {
    await env.DB.prepare(sql).run()
  }
  schemaReady = true
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function rowToBooking(r) {
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
  }
}

function bookingToParams(b) {
  return {
    id: b.id,
    studio_id: b.studioId || 'default',
    service_id: b.serviceId,
    service_name: b.serviceName || '',
    client_name: b.clientName || '',
    phone: b.phone || '',
    car: b.car || '',
    date: b.date,
    time: b.time,
    bay: b.bay ?? 1,
    status: b.status || 'pending',
    price: b.price ?? 0,
    paid: b.paid ?? 0,
    created_at: b.createdAt || new Date().toISOString(),
    reminder_enabled: b.reminderEnabled ? 1 : 0,
  }
}

export async function handleBookings(request, env, url) {
  if (!env.DB) return json({ error: 'DB не настроена' }, 500)
  try {
    await ensureSchema(env)
  } catch (e) {
    console.error('d1 schema', e)
    return json({ error: 'DB schema: ' + String(e).slice(0, 200) }, 500)
  }

  const method = request.method
  const idParam = url.pathname.startsWith('/api/bookings/') ? url.pathname.slice('/api/bookings/'.length) : ''

  try {
    if (method === 'GET') {
      const studio = url.searchParams.get('studio') || 'default'
      const { results } = await env.DB.prepare(
        'SELECT * FROM bookings WHERE studio_id = ? ORDER BY date, time',
      )
        .bind(studio)
        .all()
      return json({ bookings: results.map(rowToBooking) })
    }

    if (method === 'POST') {
    let body
    try {
      body = await request.json()
    } catch {
      return json({ error: 'bad json' }, 400)
    }
    if (!body?.id || !body?.date || !body?.time || !body?.serviceId) {
      return json({ error: 'missing fields' }, 400)
    }

    // конфликт по боксу/времени
    const { results: busy } = await env.DB.prepare(
      `SELECT id FROM bookings
       WHERE studio_id = ? AND bay = ? AND date = ? AND status != 'cancelled' AND id != ?`,
    )
      .bind(body.studioId || 'default', body.bay ?? 1, body.date, body.id)
      .all()

    const toMin = (t) => {
      const [h, m] = String(t).split(':').map(Number)
      return h * 60 + m
    }
    const start = toMin(body.time)
    // длительность услуги из запроса (или 60 по умолчанию) + запас 30 мин
    const dur = Number(body.durationMin) || 60
    const end = start + dur + 30
    const { results: sameBay } = await env.DB.prepare(
      `SELECT * FROM bookings WHERE studio_id = ? AND bay = ? AND date = ? AND status != 'cancelled'`,
    )
      .bind(body.studioId || 'default', body.bay ?? 1, body.date)
      .all()

    for (const r of sameBay) {
      const bStart = toMin(r.time)
      const bEnd = bStart + 60 + 30 // для существующих записей — час
      if (start < bEnd && bStart < end && r.id !== body.id) {
        return json({ error: 'Это время уже занято. Выберите другой слот.' }, 409)
      }
    }

    const p = bookingToParams(body)
    await env.DB.prepare(
      `INSERT INTO bookings (id, studio_id, service_id, service_name, client_name, phone, car, date, time, bay, status, price, paid, created_at, reminder_enabled)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)
       ON CONFLICT(id) DO NOTHING`,
    )
      .bind(
        p.id,
        p.studio_id,
        p.service_id,
        p.service_name,
        p.client_name,
        p.phone,
        p.car,
        p.date,
        p.time,
        p.bay,
        p.status,
        p.price,
        p.paid,
        p.created_at,
        p.reminder_enabled,
      )
      .run()

    return json({ ok: true, booking: body })
  }

  if (method === 'PATCH' && idParam) {
    let body
    try {
      body = await request.json()
    } catch {
      return json({ error: 'bad json' }, 400)
    }
    // собираем UPDATE позиционно
    const sets = []
    const vals = []
    const push = (col, val) => {
      sets.push(`${col} = ?`)
      vals.push(val)
    }
    if (body.status !== undefined) push('status', body.status)
    if (body.paid !== undefined) push('paid', body.paid)
    if (body.price !== undefined) push('price', body.price)
    if (body.date !== undefined) push('date', body.date)
    if (body.time !== undefined) push('time', body.time)
    if (body.bay !== undefined) push('bay', body.bay)
    if (body.clientName !== undefined) push('client_name', body.clientName)
    if (body.phone !== undefined) push('phone', body.phone)
    if (body.car !== undefined) push('car', body.car)
    if (body.reminderEnabled !== undefined) push('reminder_enabled', body.reminderEnabled ? 1 : 0)
    if (!sets.length) return json({ ok: true })
    vals.push(idParam)
    await env.DB.prepare(`UPDATE bookings SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run()
    return json({ ok: true })
  }

  if (method === 'DELETE' && idParam) {
      await env.DB.prepare('DELETE FROM bookings WHERE id = ?').bind(idParam).run()
      return json({ ok: true })
    }

    return json({ error: 'method' }, 405)
  } catch (e) {
    console.error('bookings api', e)
    return json({ error: String(e).slice(0, 300) }, 500)
  }
}
