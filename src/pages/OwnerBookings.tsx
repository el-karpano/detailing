import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { currentOwner, getBookings, getStudio, syncBookingsFromServer, updateBooking } from '../data/store'
import { useStoreTick } from '../lib/useStoreTick'
import { OwnerBookingRow, StatusBadge } from './OwnerDashboard'
import type { BookingStatus } from '../types'

type Filter = 'upcoming' | 'today' | 'done' | 'cancelled' | 'all'

const FILTERS: [Filter, string][] = [
  ['upcoming', 'Предстоящие'],
  ['today', 'Сегодня'],
  ['done', 'Завершённые'],
  ['cancelled', 'Отменённые'],
  ['all', 'Все'],
]

export default function OwnerBookings() {
  const nav = useNavigate()
  const owner = currentOwner()
  const studio = getStudio()
  const [filter, setFilter] = useState<Filter>('upcoming')
  const tick = useStoreTick()
  const [q, setQ] = useState('')

  useEffect(() => {
    void syncBookingsFromServer()
  }, [])

  const today = new Date().toISOString().slice(0, 10)

  const all = useMemo(() => {
    return getBookings(studio.id)
      .slice()
      .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))
  }, [studio.id, tick])

  const list = useMemo(() => {
    let rows = all
    if (filter === 'upcoming') rows = rows.filter((b) => b.status !== 'cancelled' && b.status !== 'done' && b.date + b.time >= today + '00:00')
    if (filter === 'today') rows = rows.filter((b) => b.date === today && b.status !== 'cancelled')
    if (filter === 'done') rows = rows.filter((b) => b.status === 'done')
    if (filter === 'cancelled') rows = rows.filter((b) => b.status === 'cancelled')
    const needle = q.trim().toLowerCase()
    if (needle) {
      rows = rows.filter(
        (b) =>
          b.clientName.toLowerCase().includes(needle) ||
          b.phone.includes(needle) ||
          b.car.toLowerCase().includes(needle) ||
          b.serviceName.toLowerCase().includes(needle),
      )
    }
    return rows
  }, [all, filter, q, today])

  if (!owner) {
    nav('/owner')
    return null
  }

  return (
    <main className="safe-bottom shell" style={{ paddingTop: 'var(--s5)', display: 'flex', flexDirection: 'column', gap: 'var(--s4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s3)' }}>
        <Link to="/owner/dashboard" className="text-link">
          ← Кабинет
        </Link>
      </div>
      <div>
        <h1 className="h1">Записи и оплаты</h1>
        <p className="muted" style={{ marginTop: 4 }}>
          {studio.name} · {list.length} записей
        </p>
      </div>

      <input
        className="input"
        placeholder="Поиск: имя, телефон, авто, услуга"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Поиск записей"
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {FILTERS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`button ${filter === key ? 'button-primary' : 'button-ghost'}`}
            style={{ minHeight: 36, padding: '0 12px', fontSize: 12 }}
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s2)' }}>
        {list.length === 0 && <p className="muted">Ничего не найдено</p>}
        {list.map((b) => (
          <OwnerBookingRow
            key={b.id}
            booking={b}
            onChange={() => {}}
            onStatus={(id, status: BookingStatus) => {
              updateBooking(id, { status })
            }}
          />
        ))}
      </div>

      <div style={{ display: 'flex', gap: 'var(--s2)', flexWrap: 'wrap' }}>
        {(['pending', 'accepted', 'ready', 'done'] as BookingStatus[]).map((s) => {
          const n = all.filter((b) => b.status === s).length
          return (
            <span key={s} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              <StatusBadge status={s} />
              <span className="muted small">{n}</span>
            </span>
          )
        })}
      </div>
    </main>
  )
}
