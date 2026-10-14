/**
 * Studio wall-clock timezone helpers.
 *
 * Booking `date` + `time` are LOCAL wall-clock of the studio (e.g. Minsk).
 * Workers run in UTC — `new Date("2026-10-15T09:00:00")` is UTC and drifts
 * the 24h push reminder by the offset. Always convert via these helpers.
 */

/** BY studios default to Europe/Minsk (UTC+3, no DST since 2011). */
export const DEFAULT_TZ = 'Europe/Minsk'

export function studioTz(env) {
  return env?.STUDIO_TZ || DEFAULT_TZ
}

/** Current calendar date (YYYY-MM-DD) in the studio timezone. */
export function localToday(tz = DEFAULT_TZ) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

/** Current HH:mm in the studio timezone. */
export function localNowHm(tz = DEFAULT_TZ) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date())
}

/**
 * Convert studio wall-clock date+time to UTC epoch ms.
 * date: "YYYY-MM-DD", time: "HH:mm" (local).
 */
export function wallClockToUtcMs(date, time, tz = DEFAULT_TZ) {
  const [h, m] = String(time).split(':').map(Number)
  const targetAsUtc = Date.UTC(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10)),
    h,
    m,
    0,
    0,
  )
  // offset of the timezone at that instant (ms to add to local to get UTC)
  const offsetMin = tzOffsetMinutes(targetAsUtc, tz)
  return targetAsUtc - offsetMin * 60_000
}

/** Timezone offset in minutes east of UTC at a given instant (e.g. Minsk = +180). */
export function tzOffsetMinutes(atMs, tz = DEFAULT_TZ) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const parts = dtf.formatToParts(new Date(atMs))
  const map = {}
  for (const p of parts) if (p.type !== 'literal') map[p.type] = p.value
  const asUtc = Date.UTC(
    +map.year,
    +map.month - 1,
    +map.day,
    +map.hour,
    +map.minute,
    +map.second,
  )
  return (asUtc - atMs) / 60_000
}
