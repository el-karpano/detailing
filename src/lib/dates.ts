/** Локальные даты студии (не UTC). Браузер клиента = TZ студии (BY). */

export function localIsoDate(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** "YYYY-MM-DD" + "HH:mm" → epoch ms в локальном поясе. */
export function wallClockMs(date: string, time: string): number {
  return new Date(`${date}T${time}:00`).getTime()
}

export function addDaysIso(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(y, m - 1, d + days)
  return localIsoDate(dt)
}
