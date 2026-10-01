import type { Booking, DaySchedule, OwnerUser, Studio } from '../types'
import { DEFAULT_STUDIO, seedBookings, seedSchedule } from './defaults'

type DB = {
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
      return JSON.parse(raw) as DB
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
    studio,
    schedule: seedSchedule(),
    bookings: seedBookings(studio.id, studio.services),
    owners: [
      { email: 'owner@studio.local', password: 'owner123', studioId: studio.id },
    ],
    sessionEmail: null,
  }
  save(db)
  return db
}

function save(db: DB) {
  localStorage.setItem(studioDbKey(), JSON.stringify(db))
}

let cache: DB | null = null

export function getDB(): DB {
  if (!cache) cache = load()
  return cache
}

export function commit() {
  if (cache) save(cache)
}

export function getStudio(): Studio {
  return getDB().studio
}

export function updateStudio(patch: Partial<Studio>) {
  const db = getDB()
  db.studio = { ...db.studio, ...patch }
  commit()
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

export function addBooking(booking: Booking): { ok: true; booking: Booking } | { ok: false; error: string } {
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

  db.bookings.push(booking)
  commit()
  return { ok: true, booking }
}

export function updateBooking(id: string, patch: Partial<Booking>) {
  const db = getDB()
  const idx = db.bookings.findIndex((b) => b.id === id)
  if (idx >= 0) {
    db.bookings[idx] = { ...db.bookings[idx], ...patch }
    commit()
  }
}

export function login(email: string, password: string): boolean {
  const db = getDB()
  const owner = db.owners.find((o) => o.email === email && o.password === password)
  if (!owner) return false
  db.sessionEmail = email
  commit()
  return true
}

export function logout() {
  const db = getDB()
  db.sessionEmail = null
  commit()
}

export function currentOwner(): OwnerUser | null {
  const db = getDB()
  if (!db.sessionEmail) return null
  return db.owners.find((o) => o.email === db.sessionEmail) ?? null
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
