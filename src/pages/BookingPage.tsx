import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { addBooking, getBookings, getSchedule, getStudio, markMyBooking } from '../data/store'
import { buildSlots } from '../lib/booking'
import { formatMoney } from '../lib/money'
import { ensureNotifyPermission, scheduleVisitReminder } from '../lib/reminders'
import { useStoreTick } from '../lib/useStoreTick'
import type { Booking, DaySchedule } from '../types'

const MONTHS = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
]
const WEEKDAYS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс']

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function parseDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function isoOf(dt: Date) {
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
}

function monthKey(iso: string) {
  return iso.slice(0, 7)
}

type DayMeta = {
  iso: string
  day: number
  closed: boolean
  hasFree: boolean
}

function buildMonthGrid(monthIso: string, days: DayMeta[]): (DayMeta | null)[] {
  const [y, m] = monthIso.split('-').map(Number)
  const first = new Date(y, m - 1, 1)
  const startPad = (first.getDay() + 6) % 7 // Monday-first
  const daysInMonth = new Date(y, m, 0).getDate()
  const byDay = new Map(
    days.filter((d) => monthKey(d.iso) === monthIso).map((d) => [parseDate(d.iso).getDate(), d]),
  )
  const cells: (DayMeta | null)[] = Array.from({ length: startPad }, () => null)
  for (let d = 1; d <= daysInMonth; d++) {
    const meta = byDay.get(d)
    cells.push(meta ?? { iso: `${monthIso}-${pad(d)}`, day: d, closed: true, hasFree: false })
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

function Calendar({
  days,
  selected,
  onSelect,
}: {
  days: DayMeta[]
  selected: string
  onSelect: (iso: string) => void
}) {
  const [monthIso, setMonthIso] = useState(() => monthKey(selected) || days[0]?.iso.slice(0, 7) || '')
  const months = [...new Set(days.map((d) => monthKey(d.iso)))]
  const idx = months.indexOf(monthIso)
  const cells = useMemo(() => buildMonthGrid(monthIso, days), [monthIso, days])
  const [y, m] = monthIso.split('-').map(Number)
  const todayIso = isoOf(new Date())

  return (
    <div className="calendar">
      <div className="calendar-head">
        <button
          type="button"
          className="button button-ghost icon-button"
          aria-label="Предыдущий месяц"
          disabled={idx <= 0}
          onClick={() => setMonthIso(months[idx - 1])}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="calendar-month">
          {MONTHS[m - 1]} {y}
        </div>
        <button
          type="button"
          className="button button-ghost icon-button"
          aria-label="Следующий месяц"
          disabled={idx < 0 || idx >= months.length - 1}
          onClick={() => setMonthIso(months[idx + 1])}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div className="calendar-weekdays">
        {WEEKDAYS.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>

      <div className="calendar-grid">
        {cells.map((cell, i) => {
          if (!cell) return <div key={`e-${i}`} className="calendar-day is-out" />
          const disabled = cell.closed
          return (
            <button
              key={cell.iso}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(cell.iso)}
              className={[
                'calendar-day',
                disabled ? 'is-closed' : '',
                cell.iso === todayIso ? 'is-today' : '',
                cell.iso === selected ? 'is-selected' : '',
                cell.hasFree && !disabled ? 'has-free' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span>{cell.day}</span>
              <i className="calendar-dot" aria-hidden />
            </button>
          )
        })}
      </div>

      <div className="calendar-legend">
        <span>
          <i />
          есть свободные окна
        </span>
      </div>
    </div>
  )
}

export default function BookingPage() {
  const { serviceId } = useParams()
  const [params] = useSearchParams()
  const nav = useNavigate()
  const studio = getStudio()
  const service = studio.services.find((s) => s.id === serviceId)

  const schedule = getSchedule()
  const tick = useStoreTick()
  const bookings = useMemo(() => getBookings(studio.id), [studio.id, tick])

  const [date, setDate] = useState(() => {
    const q = params.get('date')
    if (q && schedule.some((d) => d.date === q && !d.closed)) return q
    return schedule.find((d) => !d.closed)?.date ?? ''
  })
  const [time, setTime] = useState(() => params.get('time') ?? '')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [car, setCar] = useState('')
  const [error, setError] = useState('')
  const [reminder, setReminder] = useState(true)

  const slots = useMemo(() => {
    if (!service || !date) return []
    return buildSlots(studio, schedule, bookings, service, date)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, date, schedule, bookings, studio, tick])

  const freeCount = slots.filter((s) => s.available).length

  const dayMetas = useMemo<DayMeta[]>(() => {
    return schedule.map((d: DaySchedule) => {
      let hasFree = false
      if (!d.closed && service) {
        hasFree = buildSlots(studio, schedule, bookings, service, d.date).some((s) => s.available)
      }
      return {
        iso: d.date,
        day: parseDate(d.date).getDate(),
        closed: d.closed,
        hasFree,
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedule, service, studio, bookings, tick])

  // если прислали time из ИИ — проверим, что он ещё свободен
  const effectiveTime = slots.some((s) => s.time === time && s.available) ? time : ''

  // при смене дня подставляем первое свободное окно (пользователь сразу видит время)
  useEffect(() => {
    if (date && !time) {
      const first = slots.find((s) => s.available)
      if (first) setTime(first.time)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, slots])

  if (!service) {
    return (
      <main className="safe-bottom shell" style={{ paddingTop: 'var(--s8)' }}>
        <p>Услуга не найдена.</p>
        <Link to="/services" className="text-link">
          ← К услугам
        </Link>
      </main>
    )
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!date || !effectiveTime) {
      setError('Выберите дату и свободное время')
      return
    }
    if (!name.trim() || phone.trim().length < 6) {
      setError('Укажите имя и телефон')
      return
    }

    const slot = slots.find((s) => s.time === effectiveTime)
    const booking: Booking = {
      id: crypto.randomUUID(),
      studioId: studio.id,
      serviceId: service!.id,
      serviceName: service!.title,
      clientName: name.trim(),
      phone: phone.trim(),
      car: car.trim() || '—',
      date,
      time: effectiveTime,
      bay: slot?.bay ?? 1,
      status: 'pending',
      price: service!.price,
      paid: 0,
      createdAt: new Date().toISOString(),
      reminderEnabled: reminder,
    }

    const result = await addBooking(booking)
    if (result.ok === false) {
      setError(result.error)
      return
    }
    markMyBooking(result.booking.id)

    if (reminder) {
      // Web Push за сутки (если пользователь дал разрешение)
      void scheduleVisitReminder({
        id: result.booking.id,
        serviceName: result.booking.serviceName,
        date: result.booking.date,
        time: result.booking.time,
        clientName: result.booking.clientName,
      })
    }

    nav('/my', { state: { justBooked: result.booking.id } })
  }

  return (
    <main className="safe-bottom shell" style={{ paddingTop: 'var(--s5)', display: 'flex', flexDirection: 'column', gap: 'var(--s5)' }}>
      <Link to="/services" className="text-link" style={{ alignSelf: 'flex-start' }}>
        ← Назад
      </Link>

      <div>
        <h1 className="h1">Запись в студию</h1>
        <div className="booking-card" style={{ marginTop: 'var(--s4)', borderRadius: 20 }}>
          <div className="ocean-content" style={{ gap: 'var(--s3)', padding: '22px 20px' }}>
            <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.35 }}>{service.title}</div>
            <div className="muted" style={{ lineHeight: 1.55 }}>{service.description}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--s3)' }}>
              <span className="muted">Цена</span>
              <strong style={{ color: 'var(--color-accent)', whiteSpace: 'nowrap' }}>
                {formatMoney(service.price)}
                {service.priceFrom ? ' (от)' : ''}
              </strong>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s5)' }}>
        <section>
          <h2 className="h2" style={{ marginBottom: 'var(--s3)' }}>
            Дата
          </h2>
          <Calendar
            days={dayMetas}
            selected={date}
            onSelect={(iso) => {
              // смена дня: сбрасываем время и ошибку, чтобы UI не «залипал»
              setDate(iso)
              setTime('')
              setError('')
            }}
          />
        </section>

        <section>
          <h2 className="h2" style={{ marginBottom: 'var(--s3)' }}>
            Свободное время
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--s2)' }}>
            {slots.length === 0 && (
              <p className="muted" style={{ gridColumn: '1 / -1' }}>
                В этот день студия не работает — выберите другой день в календаре
              </p>
            )}
            {slots.length > 0 && freeCount === 0 && (
              <p className="muted" style={{ gridColumn: '1 / -1' }}>
                Все окна на эту дату заняты — выберите другой день (синие точки = есть места)
              </p>
            )}
            {slots.map((s) => (
              <button
                key={s.time}
                type="button"
                disabled={!s.available}
                onClick={() => {
                  setTime(s.time)
                  setError('')
                }}
                className={`button ${effectiveTime === s.time ? 'button-primary' : 'button-ghost'}`}
                style={{
                  opacity: s.available ? 1 : 0.35,
                  cursor: s.available ? 'pointer' : 'not-allowed',
                  justifyContent: 'center',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {s.time}
              </button>
            ))}
          </div>
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s3)' }}>
          <div>
            <label className="muted" htmlFor="name" style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>
              Имя
            </label>
            <input
              id="name"
              className="input"
              style={{ width: '100%' }}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Как к вам обращаться"
              required
            />
          </div>
          <div>
            <label className="muted" htmlFor="phone" style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>
              Телефон
            </label>
            <input
              id="phone"
              type="tel"
              className="input"
              style={{ width: '100%' }}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+375 ..."
              required
            />
          </div>
          <div>
            <label className="muted" htmlFor="car" style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>
              Автомобиль
            </label>
            <input
              id="car"
              className="input"
              style={{ width: '100%' }}
              value={car}
              onChange={(e) => setCar(e.target.value)}
              placeholder="Марка, модель, цвет"
            />
          </div>
        </section>

        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--s2)', fontSize: 14, color: 'var(--secondary)' }}>
            <input
              type="checkbox"
              checked={reminder}
              onChange={async (e) => {
                const on = e.target.checked
                setReminder(on)
                if (on) await ensureNotifyPermission()
              }}
            />
            Напомнить за сутки до визита
          </label>
          <p className="muted small" style={{ marginTop: 6, paddingLeft: 26 }}>
            Пришлём push-уведомление в приложение за 24 часа и добавим будильник в календарь
          </p>
        </div>

        {error && (
          <p
            role="alert"
            style={{
              border: '1px solid rgba(255,80,80,0.35)',
              background: 'rgba(255,80,80,0.1)',
              borderRadius: 16,
              padding: '10px 14px',
              fontSize: 14,
            }}
          >
            {error}
          </p>
        )}

        <button type="submit" className="button button-primary" style={{ width: '100%', padding: '16px 20px', fontSize: 16 }}>
          Подтвердить запись
        </button>

        <p className="muted small">{studio.cancelPolicy}</p>
      </form>
    </main>
  )
}
