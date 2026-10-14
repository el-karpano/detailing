#!/usr/bin/env node
/** Unit check: studio wall-clock → UTC (Minsk = +3). */
import { localToday, wallClockToUtcMs, DEFAULT_TZ } from './worker/time.js'

const cases = [
  ['2027-01-10', '09:00', Date.UTC(2027, 0, 10, 6, 0, 0)],
  ['2027-06-15', '12:30', Date.UTC(2027, 5, 15, 9, 30, 0)],
  ['2026-12-31', '23:59', Date.UTC(2026, 11, 31, 20, 59, 0)],
]

let fail = 0
for (const [date, time, expected] of cases) {
  const got = wallClockToUtcMs(date, time, DEFAULT_TZ)
  const ok = got === expected
  if (!ok) fail++
  console.log(ok ? '  OK ' : '  FAIL ', date, time, '→', new Date(got).toISOString(), 'expected', new Date(expected).toISOString())
}

const today = localToday(DEFAULT_TZ)
const re = /^\d{4}-\d{2}-\d{2}$/
console.log(re.test(today) ? '  OK ' : '  FAIL ', 'localToday', today)
if (!re.test(today)) fail++

console.log(fail ? `TZ UNIT FAIL ${fail}` : 'TZ UNIT OK')
process.exit(fail ? 1 : 0)
