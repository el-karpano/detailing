/**
 * Web Push + ICS-напоминания о визите.
 * Push: подписка → POST /api/visits → cron Worker шлёт за сутки.
 */

const STORAGE_KEY = 'detailing-notified-visits'
const VISIT_TOKENS_KEY = 'detailing-visit-tokens'

function visitTokenMap(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(VISIT_TOKENS_KEY) || '{}') as Record<string, string>
  } catch {
    return {}
  }
}

function saveVisitToken(id: string, token: string) {
  try {
    const m = visitTokenMap()
    m[id] = token
    localStorage.setItem(VISIT_TOKENS_KEY, JSON.stringify(m))
  } catch {
    /* ignore */
  }
}

export function getVisitToken(id: string): string {
  return visitTokenMap()[id] || ''
}

function notifiedSet(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as string[])
  } catch {
    return new Set()
  }
}

function markNotified(id: string) {
  const s = notifiedSet()
  s.add(id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...s].slice(-50)))
}

export type ReminderBooking = {
  id: string
  serviceName: string
  date: string
  time: string
  clientName?: string
}

function visitStart(b: ReminderBooking) {
  return new Date(`${b.date}T${b.time}:00`)
}

export function isUpcomingSoon(b: ReminderBooking) {
  const diff = visitStart(b).getTime() - Date.now()
  return diff > 0 && diff < 36 * 60 * 60 * 1000
}

/** .ics с VALARM за сутки */
export function buildIcs(b: ReminderBooking & { studioName: string; address: string }, withAlarm: boolean) {
  const dt = `${b.date.replace(/-/g, '')}T${b.time.replace(':', '')}00`
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${b.studioName}//RU`,
    'BEGIN:VEVENT',
    `UID:${b.id}@detailing`,
    `DTSTART:${dt}`,
    `SUMMARY:${b.serviceName}`,
    `DESCRIPTION:${b.studioName}`,
    `LOCATION:${b.address}`,
  ]
  if (withAlarm) {
    lines.push(
      'BEGIN:VALARM',
      'TRIGGER:-P1D',
      'ACTION:DISPLAY',
      `DESCRIPTION:Завтра ${b.serviceName} в ${b.time}`,
      'END:VALARM',
    )
  }
  lines.push('END:VEVENT', 'END:VCALENDAR')
  return lines.join('\r\n')
}

export function downloadIcs(b: ReminderBooking & { studioName: string; address: string }, withAlarm: boolean) {
  const blob = new Blob([buildIcs(b, withAlarm)], { type: 'text/calendar;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `visit-${b.date}-${b.time}.ics`
  a.click()
  URL.revokeObjectURL(a.href)
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}

/** Разрешение + push-подписка. Возвращает подписку или null. */
export async function ensurePushSubscription(): Promise<PushSubscription | null> {
  if (typeof Notification === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return null
  }
  if (Notification.permission !== 'granted') {
    const res = await Notification.requestPermission()
    if (res !== 'granted') return null
  }

  const reg = await navigator.serviceWorker.ready

  // public key с сервера (одинаковый на всех клиентах платформы)
  let publicKey = ''
  try {
    const r = await fetch('/api/push/public-key')
    const d = (await r.json()) as { publicKey?: string }
    publicKey = d.publicKey || ''
  } catch {
    /* ignore */
  }
  if (!publicKey) return null

  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    })
  }
  return sub
}

/** Сохранить визит на сервере, чтобы cron прислал push за сутки. */
export async function scheduleVisitReminder(b: ReminderBooking): Promise<boolean> {
  try {
    const subscription = await ensurePushSubscription()
    if (!subscription) return false
    const res = await fetch('/api/visits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: b.id,
        serviceName: b.serviceName,
        date: b.date,
        time: b.time,
        clientName: b.clientName || '',
        subscription,
        remind: true,
      }),
    })
    if (!res.ok) return false
    const data = (await res.json().catch(() => ({}))) as { deleteToken?: string }
    if (data.deleteToken) saveVisitToken(b.id, data.deleteToken)
    return true
  } catch {
    return false
  }
}

/** Отмена визита — убрать напоминание с сервера (по своему deleteToken). */
export async function cancelVisitReminder(id: string) {
  try {
    const token = getVisitToken(id)
    const qs = token ? `?token=${encodeURIComponent(token)}` : ''
    await fetch(`/api/visits/${encodeURIComponent(id)}${qs}`, { method: 'DELETE' })
  } catch {
    /* ignore */
  }
}

/** Fallback: если push не разрешили — уведомим при открытии PWA. */
export function fireDueReminders(bookings: ReminderBooking[]) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  const already = notifiedSet()
  for (const b of bookings) {
    if (!isUpcomingSoon(b) || already.has(b.id)) continue
    try {
      new Notification('Напоминание о визите', {
        body: `${b.serviceName} — ${b.date.slice(5).replace('-', '.')} в ${b.time}`,
        tag: `visit-${b.id}`,
      })
      markNotified(b.id)
    } catch {
      /* ignore */
    }
  }
}

/** Замена старого ensureNotifyPermission */
export async function ensureNotifyPermission(): Promise<boolean> {
  if (typeof Notification === 'undefined') return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const res = await Notification.requestPermission()
  return res === 'granted'
}
