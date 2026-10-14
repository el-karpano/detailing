/**
 * API записей на сервере (D1). localStorage остаётся кэшем.
 *
 * GET без Bearer → публичные слоты (без PII).
 * GET с Bearer владельца → полные записи.
 * PATCH: владелец или клиент (только status=cancelled + clientToken).
 */
import type { Booking } from '../types'
import { authHeaders } from './auth'

async function req(path: string, init?: RequestInit) {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(init?.headers || {}) },
  })
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    const msg = typeof data.error === 'string' ? data.error : `HTTP ${res.status}`
    throw new Error(msg)
  }
  return data
}

export async function fetchServerBookings(studioSlug: string): Promise<Booking[]> {
  const data = await req(`/api/bookings?studio=${encodeURIComponent(studioSlug)}`)
  return (data.bookings as Booking[]) || []
}

export async function pushBooking(
  booking: Booking,
): Promise<{ ok: boolean; clientToken?: string; booking?: Booking; error?: string }> {
  const data = await req('/api/bookings', { method: 'POST', body: JSON.stringify(booking) })
  return {
    ok: true,
    clientToken: typeof data.clientToken === 'string' ? data.clientToken : undefined,
    booking: data.booking as Booking | undefined,
  }
}

export async function patchBooking(id: string, patch: Partial<Booking>) {
  await req(`/api/bookings/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

/** Отмена своей записи без входа в кабинет (clientToken). */
export async function cancelOwnBooking(id: string, clientToken: string) {
  await req(`/api/bookings/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'cancelled', clientToken }),
  })
}

export async function deleteServerBooking(id: string) {
  await req(`/api/bookings/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
