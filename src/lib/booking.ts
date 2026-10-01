import type { Booking, DaySchedule, Service, Studio } from '../types'
import { toTime } from '../data/store'

export type Slot = {
  time: string
  bay: number
  available: boolean
}

const SLOT_STEP = 30

export function buildSlots(
  studio: Studio,
  schedule: DaySchedule[],
  bookings: Booking[],
  service: Service,
  date: string,
): Slot[] {
  const day = schedule.find((s) => s.date === date)
  if (!day || day.closed) return []

  const open = toMin(day.open)
  const close = toMin(day.close)
  const need = service.durationMin + studio.prepMin
  const slots: Slot[] = []

  for (let start = open; start + need <= close; start += SLOT_STEP) {
    const end = start + need
    for (let bay = 1; bay <= studio.bays; bay++) {
      const busy = bookings.some((b) => {
        if (b.studioId !== studio.id) return false
        if (b.date !== date) return false
        if (b.bay !== bay) return false
        if (b.status === 'cancelled') return false
        const bStart = toMin(b.time)
        const bDur = studio.services.find((s) => s.id === b.serviceId)?.durationMin ?? 60
        const bEnd = bStart + bDur + studio.prepMin
        return start < bEnd && bStart < end
      })
      slots.push({
        time: toTime(start),
        bay,
        available: !busy,
      })
    }
  }

  // collapse to unique times: a time is available if any bay is free
  const byTime = new Map<string, Slot>()
  for (const s of slots) {
    const prev = byTime.get(s.time)
    if (!prev) byTime.set(s.time, s)
    else if (s.available) byTime.set(s.time, s)
  }
  return [...byTime.values()].sort((a, b) => a.time.localeCompare(b.time))
}

function toMin(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export function bookingStats(bookings: Booking[]) {
  const active = bookings.filter((b) => b.status !== 'cancelled')
  const money = active.reduce((s, b) => s + b.paid, 0)
  const planned = active.reduce((s, b) => s + b.price, 0)
  const done = active.filter((b) => b.status === 'done').length
  return {
    total: active.length,
    done,
    money,
    planned,
  }
}
