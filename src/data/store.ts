import type { Booking, DaySchedule, OwnerUser, Studio } from '../types'
import { DEFAULT_STUDIO, DEFAULTS_REV, seedBookings, seedSchedule } from './defaults'
import {
  cancelOwnBooking,
  deleteServerBooking,
  fetchServerBookings,
  patchBooking as apiPatchBooking,
  pushBooking,
} from '../lib/bookingsApi'
import { fetchStudioProfile, pushStudioProfile } from '../lib/studioApi'
import { getAuthToken, setAuthToken } from '../lib/auth'

type DB = {
  defaultsRev?: number
  studio: Studio
  schedule: DaySchedule[]
  bookings: Booking[]
  owners: OwnerUser[]
  sessionEmail: string | null
}

let slugCache: string | null = null

function studioSlug() {
  if (slugCache === null) {
    slugCache = new URLSearchParams(window.location.search).get('studio')?.trim() || 'default'
  }
  return slugCache
}

function studioDbKey() {
  return `detailing-mvp-db-v1:${studioSlug()}`
}

function load(): DB {
  const raw = localStorage.getItem(studioDbKey())
  if (raw) {
    try {
      const db = JSON.parse(raw) as DB
      // всегда сверяем длину расписания и часы работы
      const m = String(db.studio?.workHours || '').match(/(\d{1,2}:\d{2})\s*[–—-]\s*(\d{1,2}:\d{2})/)
      const open = m?.[1]?.padStart(5, '0') || '09:00'
      const close = m?.[2]?.padStart(5, '0') || '20:00'
      const first = db.schedule?.[0]
      const badHours = first && (first.open !== open || first.close !== close)
      if (!Array.isArray(db.schedule) || db.schedule.length < 60 || badHours) {
        db.schedule = seedSchedule(60, db.studio?.workHours)
        save(db)
      }
      if (db.defaultsRev === DEFAULTS_REV) return db
      // Контент в коде обновился — обновляем услуги/фото/тексты, записи не трогаем.
      const slug = studioSlug()
      const fresh = structuredClone(DEFAULT_STUDIO)
      if (slug !== 'default') {
        fresh.id = `studio-${slug}`
        fresh.name = slug
      }
      db.studio = {
        ...fresh,
        id: db.studio.id,
        name: db.studio.name,
        bays: db.studio.bays,
        prepMin: db.studio.prepMin,
      }
      db.schedule = seedSchedule(60, db.studio.workHours)
      db.defaultsRev = DEFAULTS_REV
      save(db)
      return db
    } catch {
      /* reseed */
    }
  }
  const studio = structuredClone(DEFAULT_STUDIO)
  const slug = studioSlug()
  if (slug !== 'default') {
    studio.id = `studio-${slug}`
    studio.name = slug
  }
  const db: DB = {
    defaultsRev: DEFAULTS_REV,
    studio,
    schedule: seedSchedule(60, studio.workHours),
    bookings: seedBookings(studio.id, studio.services),
    owners: [],
    sessionEmail: null,
  }
  save(db)
  return db
}

function save(db: DB) {
  localStorage.setItem(studioDbKey(), JSON.stringify(db))
}

let cache: DB | null = null

// —— реактивность: чтобы UI обновлялся после sync/изменений ——
let version = 0
const listeners = new Set<() => void>()

export function subscribeStore(fn: () => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function getStoreVersion() {
  return version
}

function bump() {
  version++
  for (const fn of listeners) fn()
}

export function getDB(): DB {
  if (!cache) cache = load()
  return cache
}

export function commit() {
  if (cache) save(cache)
  bump()
}

/** Подтянуть записи с сервера (D1) в локальный кэш. Демо-seed на сервер не уезжает. */
export async function syncBookingsFromServer(): Promise<boolean> {
  const db = getDB()
  try {
    // единый ключ студии: studio.id — и при сохранении, и при загрузке
    const remoteRaw = await fetchServerBookings(db.studio.id)
    if (!Array.isArray(remoteRaw)) return false
    const remote = remoteRaw.map((b) => ({ ...b, studioId: db.studio.id }))

    const remoteIds = new Set(remote.map((b) => b.id))
    const mine = new Set(getMyBookingIds())
    const localOnly = db.bookings.filter(
      (b) => mine.has(b.id) && !remoteIds.has(b.id) && !b.id.startsWith('seed-'),
    )
    for (const b of localOnly) {
      void pushBooking({ ...b, studioId: db.studio.id }).catch(() => {})
    }
    // Публичный GET отдаёт слоты без PII — для своих записей сохраняем локальные имя/телефон/авто.
    const mergedRemote = remote.map((b) => {
      const local = db.bookings.find((x) => x.id === b.id)
      const keepLocal = local && mine.has(b.id) && !b.phone
      return keepLocal
        ? {
            ...b,
            clientName: b.clientName || local.clientName,
            phone: b.phone || local.phone,
            car: b.car || local.car,
            clientToken: b.clientToken || local.clientToken,
            price: b.price || local.price,
          }
        : b
    })
    db.bookings = [...mergedRemote, ...localOnly]
    commit() // уже вызывает bump
    return true
  } catch {
    return false
  }
}

export function getStudio(): Studio {
  return getDB().studio
}

export function updateStudio(patch: Partial<Studio>) {
  const db = getDB()
  db.studio = { ...db.studio, ...patch }
  commit()
  void pushStudioProfile(db.studio).catch(() => {})
}

/** Подтянуть профиль студии с сервера (фото/цены из админки). */
export async function syncStudioFromServer(): Promise<boolean> {
  const db = getDB()
  try {
    const remote = await fetchStudioProfile(db.studio.id)
    if (!remote) return false
    db.studio = {
      ...db.studio,
      ...remote,
      id: db.studio.id,
      services: remote.services?.length ? remote.services : db.studio.services,
      photos: Array.isArray(remote.photos) ? remote.photos : db.studio.photos,
      infoCards: remote.infoCards?.length ? remote.infoCards : db.studio.infoCards,
    }
    commit()
    return true
  } catch {
    return false
  }
}

export function getSchedule(): DaySchedule[] {
  return getDB().schedule
}

export function getBookings(studioId?: string): Booking[] {
  const db = getDB()
  return studioId ? db.bookings.filter((b) => b.studioId === studioId) : db.bookings
}

function myIdsKey() {
  return `detailing-mvp-my-ids:${studioSlug()}`
}

export function getMyBookingIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem(myIdsKey()) || '[]') as string[]
  } catch {
    return []
  }
}

export function markMyBooking(id: string) {
  const ids = getMyBookingIds()
  if (!ids.includes(id)) {
    ids.push(id)
    localStorage.setItem(myIdsKey(), JSON.stringify(ids))
  }
}

export function getMyBookings(): Booking[] {
  const ids = new Set(getMyBookingIds())
  return getBookings().filter((b) => ids.has(b.id) && b.status !== 'cancelled')
}

export async function addBooking(
  booking: Booking,
): Promise<{ ok: true; booking: Booking } | { ok: false; error: string }> {
  const db = getDB()
  // Atomic conflict check: same bay, same date, overlapping time
  const service = db.studio.services.find((s) => s.id === booking.serviceId)
  const duration = service?.durationMin ?? 60
  const prep = db.studio.prepMin
  const startMin = toMin(booking.time)
  const endMin = startMin + duration + prep

  const conflict = db.bookings.find((b) => {
    if (b.studioId !== booking.studioId) return false
    if (b.bay !== booking.bay) return false
    if (b.date !== booking.date) return false
    if (b.status === 'cancelled') return false
    const bStart = toMin(b.time)
    const bDur = db.studio.services.find((s) => s.id === b.serviceId)?.durationMin ?? 60
    const bEnd = bStart + bDur + db.studio.prepMin
    return startMin < bEnd && bStart < endMin
  })

  if (conflict) {
    return { ok: false, error: 'Это время уже занято. Выберите другой слот.' }
  }

  // Idempotency: same client+phone+date+time+service
  const duplicate = db.bookings.find(
    (b) =>
      b.studioId === booking.studioId &&
      b.phone === booking.phone &&
      b.date === booking.date &&
      b.time === booking.time &&
      b.serviceId === booking.serviceId &&
      b.status !== 'cancelled',
  )
  if (duplicate) {
    return { ok: true, booking: duplicate }
  }

  // Сервер (D1) — источник истины. Конфликт там = слот занят с другого устройства.
  let clientToken: string | undefined
  try {
    const res = await pushBooking({ ...booking, durationMin: duration } as Booking)
    if (res.ok && res.clientToken) clientToken = res.clientToken
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/занят|409|conflict/i.test(msg)) {
      // протянем свежие записи, чтобы UI обновился
      await syncBookingsFromServer().catch(() => {})
      return { ok: false, error: 'Это время уже занято. Выберите другой слот.' }
    }
    // офлайн / временная ошибка — сохраняем локально
  }

  const saved: Booking = clientToken ? { ...booking, clientToken } : booking
  db.bookings.push(saved)
  // Пока записи нет на сервере — держим её за этим устройством, иначе sync её выкинет.
  markMyBooking(booking.id)
  commit()
  return { ok: true, booking: saved }
}

export function updateBooking(id: string, patch: Partial<Booking>) {
  const db = getDB()
  const idx = db.bookings.findIndex((b) => b.id === id)
  if (idx < 0) return
  const prev = db.bookings[idx]
  db.bookings[idx] = { ...prev, ...patch }
  commit()

  const onlyCancel = patch.status === 'cancelled' && Object.keys(patch).every((k) => k === 'status')
  if (onlyCancel && prev.clientToken && !getAuthToken()) {
    // клиент отменяет свою запись без входа
    void cancelOwnBooking(id, prev.clientToken).catch(() => {})
    return
  }
  // владелец (или прочие правки) — обычный PATCH с Bearer
  void apiPatchBooking(id, patch).catch(() => {})
}

export function deleteBooking(id: string) {
  const db = getDB()
  const before = db.bookings.length
  db.bookings = db.bookings.filter((b) => b.id !== id)
  if (db.bookings.length === before) return
  commit()
  void deleteServerBooking(id).catch(() => {})
}

/** Вход владельца — проверка email/пароля на сервере (D1 owners). */
export async function login(email: string, password: string): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      token?: string
      email?: string
      studioId?: string
      name?: string
    }
    if (!res.ok || !data.token) return false
    setAuthToken(data.token)
    const db = getDB()
    const emailLc = (data.email || email).trim().toLowerCase()
    db.owners = [
      {
        email: emailLc,
        password: '',
        studioId: data.studioId || db.studio.id,
      },
    ]
    db.sessionEmail = emailLc
    commit()
    return true
  } catch {
    return false
  }
}

export function logout() {
  const token = getAuthToken()
  if (token) {
    void fetch('/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {})
  }
  setAuthToken('')
  const db = getDB()
  db.sessionEmail = null
  commit()
}

export function currentOwner(): OwnerUser | null {
  const db = getDB()
  // сессия жива, пока есть серверный токен
  if (!db.sessionEmail || !getAuthToken()) return null
  return {
    email: db.sessionEmail,
    password: '',
    studioId: db.owners.find((o) => o.email === db.sessionEmail)?.studioId || db.studio.id,
  }
}

function toMin(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export function toTime(min: number) {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
