import type { Booking, DaySchedule, Service, Studio } from '../types'
import { localIsoDate } from '../lib/dates'
import { CLIENT_BRAND, CLIENT_SLUG, CLIENT_STUDIO, CLIENT_WORKER, DEFAULTS_REV } from './client-data'

export { CLIENT_BRAND, CLIENT_SLUG, CLIENT_STUDIO, CLIENT_WORKER, DEFAULTS_REV }

/** Поднять при изменении услуг/фото/текстов — перезальёт контент из кода в localStorage. */
export const DEFAULT_STUDIO: Studio = {
  ...(CLIENT_STUDIO as unknown as Studio),
  id: `studio-${CLIENT_SLUG}`,
}

function parseWorkHours(workHours?: string): { open: string; close: string } {
  const m = String(workHours || '').match(/(\d{1,2}:\d{2})\s*[–—-]\s*(\d{1,2}:\d{2})/)
  return {
    open: m?.[1]?.padStart(5, '0') || '09:00',
    close: m?.[2]?.padStart(5, '0') || '20:00',
  }
}

export function seedSchedule(days = 60, workHours?: string): DaySchedule[] {
  const { open, close } = parseWorkHours(workHours)
  const out: DaySchedule[] = []
  const now = new Date()
  for (let i = 0; i < days; i++) {
    const d = new Date(now)
    d.setDate(now.getDate() + i)
    const iso = localIsoDate(d)
    const dow = d.getDay()
    out.push({
      date: iso,
      open,
      close,
      closed: dow === 0,
    })
  }
  return out
}

export function seedBookings(studioId: string, services: Service[]): Booking[] {
  // Демо-записи только для локального превью (id seed-*), на сервер НЕ отправляются.
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  const dayAfter = new Date(now)
  dayAfter.setDate(now.getDate() + 2)
  const svc = services[0]
  return [
    {
      id: 'seed-1',
      studioId,
      serviceId: svc.id,
      serviceName: svc.title,
      clientName: 'Иван Петров',
      phone: '+7 (900) 111-22-33',
      car: 'BMW X5, чёрный',
      date: localIsoDate(tomorrow),
      time: '10:00',
      bay: 1,
      status: 'accepted',
      price: svc.price,
      paid: 0,
      createdAt: now.toISOString(),
      reminderEnabled: true,
    },
    {
      id: 'seed-2',
      studioId,
      serviceId: services[1]?.id ?? svc.id,
      serviceName: services[1]?.title ?? svc.title,
      clientName: 'Алексей Смирнов',
      phone: '+7 (900) 222-33-44',
      car: 'Audi Q7, белый',
      date: localIsoDate(dayAfter),
      time: '13:00',
      bay: 2,
      status: 'pending',
      price: services[1]?.price ?? svc.price,
      paid: 0,
      createdAt: now.toISOString(),
      reminderEnabled: false,
    },
  ]
}
