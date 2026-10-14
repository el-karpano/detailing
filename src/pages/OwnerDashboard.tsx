import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  addBooking,
  currentOwner,
  deleteBooking,
  getBookings,
  getSchedule,
  getStudio,
  logout,
  syncBookingsFromServer,
  updateBooking,
} from '../data/store'
import { buildSlots, bookingStats } from '../lib/booking'
import { localIsoDate } from '../lib/dates'
import { formatMoney } from '../lib/money'
import { useStoreTick } from '../lib/useStoreTick'
import type { Booking, BookingStatus } from '../types'

function todayIso() {
  return localIsoDate()
}

function PhoneLink({ phone }: { phone: string }) {
  const digits = phone.replace(/[^\d+]/g, '')
  if (!digits) return <span className="muted small">Телефон не указан</span>
  return (
    <a
      href={`tel:${digits}`}
      className="text-link small"
      style={{ fontVariantNumeric: 'tabular-nums' }}
      aria-label={`Позвонить клиенту ${phone}`}
    >
      {phone}
    </a>
  )
}

function fmtDate(iso: string) {
  const parts = iso.split('-').map(Number)
  const d = parts[2]
  const m = parts[1]
  const months = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
  return `${d} ${months[(m || 1) - 1]}`
}

export default function OwnerDashboard() {
  const nav = useNavigate()
  const owner = currentOwner()
  const studio = getStudio()
  const tick = useStoreTick()
  const [syncing, setSyncing] = useState(false)
  const [showAdd, setShowAdd] = useState(false)

  // подтягиваем записи с сервера при открытии
  useEffect(() => {
    let alive = true
    setSyncing(true)
    void syncBookingsFromServer().finally(() => {
      if (alive) setSyncing(false)
    })
    return () => {
      alive = false
    }
  }, [])

  const bookings = useMemo(
    () =>
      getBookings(studio.id)
        .slice()
        .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)),
    [studio.id, tick],
  )

  const stats = useMemo(() => bookingStats(bookings), [bookings])
  const today = todayIso()
  const todayList = bookings.filter((b) => b.date === today && b.status !== 'cancelled')
  const upcoming = bookings.filter(
    (b) => b.status !== 'cancelled' && b.status !== 'done' && b.date + b.time >= today + '00:00',
  )
  const pending = bookings.filter((b) => b.status === 'pending' && b.date >= today)

  const week = useMemo(() => {
    const from = new Date()
    from.setDate(from.getDate() - 7)
    const fromIso = localIsoDate(from)
    return bookings.filter((b) => b.date >= fromIso && b.status !== 'cancelled')
  }, [bookings])

  if (!owner) {
    nav('/owner')
    return null
  }

  async function changeStatus(id: string, status: BookingStatus) {
    const ok = await updateBooking(id, { status })
    if (!ok) alert('Не удалось изменить статус на сервере')
  }

  return (
    <main className="safe-bottom shell" style={{ paddingTop: 'var(--s5)', display: 'flex', flexDirection: 'column', gap: 'var(--s5)' }}>
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--s3)' }}>
        <div>
          <h1 className="h1">Кабинет</h1>
          <p className="muted" style={{ marginTop: 4 }}>
            {studio.name}
            {syncing ? ' · обновляем…' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--s2)' }}>
          <button
            type="button"
            className="button button-ghost"
            style={{ minHeight: 40, padding: '0 12px', fontSize: 13 }}
            onClick={() => {
              setSyncing(true)
              void syncBookingsFromServer().finally(() => setSyncing(false))
            }}
          >
            ⟳
          </button>
          <button
            type="button"
            className="button button-ghost"
            style={{ minHeight: 40, padding: '0 12px', fontSize: 13 }}
            onClick={() => {
              logout()
              nav('/owner')
            }}
          >
            Выйти
          </button>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--s2)' }}>
        <Stat label="Сегодня" value={String(todayList.length)} />
        <Stat label="Новые" value={String(pending.length)} />
        <Stat label="Получено" value={formatMoney(stats.money)} />
      </div>

      {/* Расписание дня */}
      <section>
        <h2 className="h2">Сегодня · {fmtDate(today)}</h2>
        <div style={{ marginTop: 'var(--s3)', display: 'flex', flexDirection: 'column', gap: 'var(--s2)' }}>
          {todayList.length === 0 && <p className="muted">Записей на сегодня нет</p>}
          {todayList.map((b) => (
            <div
              key={b.id}
              style={{
                display: 'flex',
                gap: 'var(--s3)',
                alignItems: 'center',
                background: 'var(--raised)',
                border: '1px solid var(--stroke)',
                borderRadius: 16,
                padding: '12px 14px',
              }}
            >
              <div
                style={{
                  fontVariantNumeric: 'tabular-nums',
                  fontWeight: 700,
                  fontSize: 15,
                  minWidth: 48,
                  color: b.status === 'done' ? 'var(--secondary)' : 'var(--color-accent)',
                }}
              >
                {b.time}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{b.serviceName}</div>
                <div className="muted small">
                  {b.clientName} · {b.car}
                </div>
                <div style={{ marginTop: 2 }}>
                  <PhoneLink phone={b.phone} />
                </div>
              </div>
              <StatusBadge status={b.status} />
            </div>
          ))}
        </div>
      </section>

      {/* Ожидают подтверждения */}
      {pending.length > 0 && (
        <section>
          <h2 className="h2">Ждут подтверждения</h2>
          <div style={{ marginTop: 'var(--s3)', display: 'flex', flexDirection: 'column', gap: 'var(--s2)' }}>
            {pending.slice(0, 5).map((b) => (
              <OwnerBookingRow key={b.id} booking={b} onChange={() => {}} onStatus={changeStatus} />
            ))}
          </div>
        </section>
      )}

      {/* Ближайшие */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="h2">Ближайшие записи</h2>
          <Link to="/owner/bookings" className="text-link" style={{ fontSize: 13 }}>
            Все →
          </Link>
        </div>
        <div style={{ marginTop: 'var(--s3)', display: 'flex', flexDirection: 'column', gap: 'var(--s2)' }}>
          {upcoming.filter((b) => b.date !== today || !todayList.some((t) => t.id === b.id)).slice(0, 6).map((b) => (
            <OwnerBookingRow key={b.id} booking={b} onChange={() => {}} onStatus={changeStatus} />
          ))}
          {upcoming.length === 0 && <p className="muted">Активных записей нет</p>}
        </div>
      </section>

      <button type="button" className="button button-primary" onClick={() => setShowAdd((v) => !v)}>
        {showAdd ? 'Скрыть форму' : '+ Добавить запись вручную'}
      </button>

      {showAdd && (
        <AddBookingForm
          onDone={() => {
            setShowAdd(false)
          }}
        />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s2)' }}>
        <Link to="/owner/bookings" className="button button-secondary" style={{ width: '100%' }}>
          Записи и оплаты
        </Link>
        <Link to="/owner/settings" className="button button-secondary" style={{ width: '100%' }}>
          Настройки студии
        </Link>
      </div>

      <p className="muted small">За неделю: {week.length} машин · завершено {week.filter((b) => b.status === 'done').length}</p>
    </main>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: 'var(--raised)',
        border: '1px solid var(--stroke)',
        borderRadius: 16,
        padding: '12px 14px',
      }}
    >
      <div className="muted small">{label}</div>
      <div style={{ marginTop: 4, fontSize: 18, fontWeight: 700 }}>{value}</div>
    </div>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    pending: { label: 'Новая', color: '#eab308' },
    accepted: { label: 'Принята', color: 'var(--color-accent)' },
    ready: { label: 'Готова', color: '#34d399' },
    done: { label: 'Завершена', color: 'var(--secondary)' },
    cancelled: { label: 'Отмена', color: '#f87171' },
  }
  const s = map[status] ?? map.pending
  return (
    <span
      style={{
        fontSize: 11,
        padding: '3px 8px',
        borderRadius: 999,
        color: s.color,
        background: 'color-mix(in srgb, currentColor 12%, transparent)',
        whiteSpace: 'nowrap',
      }}
    >
      {s.label}
    </span>
  )
}

export function OwnerBookingRow({
  booking,
  onChange,
  onStatus,
}: {
  booking: Booking
  onChange: () => void
  onStatus?: (id: string, status: BookingStatus) => void
}) {
  return (
    <div
      style={{
        background: 'var(--raised)',
        border: '1px solid var(--stroke)',
        borderRadius: 16,
        padding: 'var(--s3) 14px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--s2)', alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>
            {booking.time} · {booking.serviceName}
          </div>
          <div className="muted small">
            {fmtDate(booking.date)} · бокс {booking.bay} · {booking.clientName} · {booking.car}
          </div>
          <div style={{ marginTop: 2 }}>
            <PhoneLink phone={booking.phone} />
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: 'var(--color-accent)', fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap' }}>
            {formatMoney(booking.price)}
          </div>
          <div className="muted small">опл. {formatMoney(booking.paid)}</div>
        </div>
      </div>
      <div style={{ marginTop: 'var(--s2)', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <StatusBadge status={booking.status} />
        {(
          [
            ['accepted', 'Принять'],
            ['ready', 'Готова'],
            ['done', 'Завершить'],
            ['cancelled', 'Отмена'],
          ] as [BookingStatus, string][]
        ).map(([s, label]) => (
          <button
            key={s}
            type="button"
            className="button button-ghost"
            style={{ minHeight: 32, padding: '0 10px', fontSize: 11, borderRadius: 10 }}
            onClick={() => {
              if (s === 'cancelled' && !confirm('Отменить запись?')) return
              if (onStatus) onStatus(booking.id, s)
              else {
                void updateBooking(booking.id, { status: s }).then((ok) => {
                  if (!ok) alert('Не удалось изменить статус на сервере')
                  onChange()
                })
              }
            }}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          className="button button-ghost"
          style={{ minHeight: 32, padding: '0 10px', fontSize: 11, borderRadius: 10 }}
          onClick={() => {
            const v = prompt('Оплата', String(booking.paid))
            if (v == null) return
            void updateBooking(booking.id, { paid: Number(v) || 0 }).then((ok) => {
              if (!ok) alert('Не удалось сохранить оплату')
              onChange()
            })
          }}
        >
          Оплата
        </button>
        <button
          type="button"
          className="button button-ghost"
          style={{
            minHeight: 32,
            padding: '0 10px',
            fontSize: 11,
            borderRadius: 10,
            color: '#f87171',
          }}
          onClick={() => {
            if (!confirm(`Удалить запись ${booking.clientName} ${booking.date} ${booking.time}?`)) return
            void deleteBooking(booking.id).then((ok) => {
              if (!ok) alert('Не удалось удалить запись на сервере')
              onChange()
            })
          }}
        >
          Удалить
        </button>
      </div>
    </div>
  )
}

function AddBookingForm({ onDone }: { onDone: () => void }) {
  const studio = getStudio()
  const schedule = getSchedule()
  const bookings = getBookings(studio.id)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [car, setCar] = useState('')
  const [serviceId, setServiceId] = useState(studio.services[0]?.id ?? '')
  const [date, setDate] = useState(todayIso())
  const [time, setTime] = useState('12:00')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const service = studio.services.find((s) => s.id === serviceId)
  const freeSlots = useMemo(() => {
    if (!service || !date) return []
    return buildSlots(studio, schedule, bookings, service, date).filter((s) => s.available)
  }, [service, date, studio, schedule, bookings])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!name.trim() || phone.trim().length < 6) {
      setError('Укажите имя и телефон')
      return
    }
    if (!service) {
      setError('Выберите услугу')
      return
    }
    setBusy(true)
    const r = await addBooking({
      id: crypto.randomUUID(),
      studioId: studio.id,
      serviceId: service.id,
      serviceName: service.title,
      clientName: name.trim(),
      phone: phone.trim(),
      car: car.trim() || '—',
      date,
      time,
      bay: freeSlots.find((s) => s.time === time)?.bay ?? 1,
      status: 'accepted',
      price: service.price,
      paid: 0,
      createdAt: new Date().toISOString(),
      reminderEnabled: false,
    })
    setBusy(false)
    if (r.ok === false) {
      setError(r.error)
      return
    }
    onDone()
  }

  return (
    <form
      onSubmit={submit}
      className="booking-card"
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s3)', padding: 'var(--s4)' }}
    >
      <h3 style={{ fontWeight: 700, fontSize: 15 }}>Новая запись</h3>
      <input className="input" placeholder="Имя клиента" value={name} onChange={(e) => setName(e.target.value)} required />
      <input className="input" placeholder="Телефон" value={phone} onChange={(e) => setPhone(e.target.value)} required />
      <input className="input" placeholder="Автомобиль" value={car} onChange={(e) => setCar(e.target.value)} />
      <select
        className="input"
        value={serviceId}
        onChange={(e) => {
          setServiceId(e.target.value)
          setTime('')
        }}
      >
        {studio.services.map((s) => (
          <option key={s.id} value={s.id}>
            {s.title} · {formatMoney(s.price)}
          </option>
        ))}
      </select>
      <input className="input" type="date" value={date} onChange={(e) => { setDate(e.target.value); setTime('') }} required />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
        {freeSlots.length === 0 && (
          <p className="muted small" style={{ gridColumn: '1 / -1' }}>
            Нет свободных окон на эту дату
          </p>
        )}
        {freeSlots.map((s) => (
          <button
            key={s.time}
            type="button"
            className={`button ${time === s.time ? 'button-primary' : 'button-ghost'}`}
            style={{ minHeight: 36, fontSize: 12, padding: 0, justifyContent: 'center' }}
            onClick={() => setTime(s.time)}
          >
            {s.time}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" style={{ color: '#fca5a5', fontSize: 13 }}>
          {error}
        </p>
      )}

      <button type="submit" className="button button-primary" disabled={busy || !time}>
        {busy ? 'Сохраняем…' : 'Создать запись'}
      </button>
    </form>
  )
}
