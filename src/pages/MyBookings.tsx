import { useLocation, useNavigate } from 'react-router-dom'
import { getMyBookings, getStudio, updateBooking } from '../data/store'
import { formatMoney } from '../lib/money'
import { cancelVisitReminder, downloadIcs } from '../lib/reminders'
import { useStoreTick } from '../lib/useStoreTick'

export default function MyBookings() {
  useStoreTick()
  const studio = getStudio()
  const nav = useNavigate()
  const loc = useLocation()
  const justBooked = (loc.state as { justBooked?: string } | null)?.justBooked

  const bookings = getMyBookings().sort((a, b) =>
    (a.date + a.time).localeCompare(b.date + b.time),
  )

  return (
    <main className="safe-bottom shell" style={{ paddingTop: 'var(--s6)' }}>
      <h1 className="h1">Моя запись</h1>
      <p className="muted" style={{ marginTop: 'var(--s2)' }}>
        Ваши визиты в {studio.name}
      </p>

      {justBooked && (
        <div
          className="card"
          style={{
            marginTop: 'var(--s4)',
            padding: 'var(--s4)',
            borderColor: 'rgba(38,148,254,0.35)',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-accent)' }}>
            Запись подтверждена
          </div>
          <p className="muted small" style={{ marginTop: 6 }}>
            Мы сохранили ваш визит. Возле времени будет видно, если оно занято другим клиентом.
          </p>
        </div>
      )}

      {bookings.length === 0 && (
        <div
          className="card"
          style={{
            marginTop: 'var(--s5)',
            padding: 'var(--s8) var(--s5)',
            textAlign: 'center',
          }}
        >
          <div
            aria-hidden
            style={{
              width: 56,
              height: 56,
              borderRadius: 18,
              background: 'var(--overlay)',
              border: '1px solid var(--stroke)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 'var(--s4)',
            }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" opacity="0.7">
              <rect x="4" y="5" width="16" height="15" rx="3" />
              <path d="M8 3v4M16 3v4M4 10h16" />
            </svg>
          </div>
          <div style={{ fontWeight: 650, fontSize: 16 }}>Пока нет записей</div>
          <p className="muted small" style={{ marginTop: 6, maxWidth: 260, marginInline: 'auto' }}>
            Выберите услугу и удобное время — запись появится здесь.
          </p>
          <button
            type="button"
            className="button button-primary"
            style={{ marginTop: 'var(--s5)', width: '100%', maxWidth: 280 }}
            onClick={() => nav('/services')}
          >
            Выбрать услугу
          </button>
        </div>
      )}

      <div style={{ marginTop: 'var(--s5)', display: 'flex', flexDirection: 'column', gap: 'var(--s3)' }}>
        {bookings.map((b) => (
          <article key={b.id} className="card" style={{ padding: 'var(--s4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--s3)' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 650, fontSize: 15 }}>{b.serviceName}</div>
                <div className="muted small" style={{ marginTop: 4 }}>
                  {b.date} · {b.time} · бокс {b.bay}
                </div>
                <div className="muted small" style={{ marginTop: 2 }}>
                  {b.clientName}
                  {b.car && b.car !== '—' ? ` · ${b.car}` : ''}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-accent)' }}>
                  {formatMoney(b.price)}
                </div>
                <StatusBadge status={b.status} />
              </div>
            </div>
            {b.reminderEnabled && (
              <div className="muted" style={{ marginTop: 'var(--s3)', fontSize: 12, lineHeight: 1.4 }}>
                Напоминание за сутки — уведомим при открытии приложения
              </div>
            )}
            <div style={{ marginTop: 'var(--s3)', display: 'flex', gap: 'var(--s2)', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="button button-secondary"
                style={{ minHeight: 40, padding: '0 14px', fontSize: 13, borderRadius: 12 }}
                onClick={() => {
                  downloadIcs(
                    {
                      id: b.id,
                      serviceName: b.serviceName,
                      date: b.date,
                      time: b.time,
                      studioName: studio.name,
                      address: studio.address,
                    },
                    b.reminderEnabled,
                  )
                }}
              >
                В календарь
              </button>
              <button
                type="button"
                className="button button-ghost"
                style={{
                  minHeight: 40,
                  padding: '0 14px',
                  fontSize: 13,
                  borderRadius: 12,
                  color: '#fca5a5',
                  borderColor: 'rgba(248,113,113,0.35)',
                }}
                onClick={() => {
                  if (confirm('Отменить запись?')) {
                    updateBooking(b.id, { status: 'cancelled' })
                    if (b.reminderEnabled) void cancelVisitReminder(b.id)
                    nav(0)
                  }
                }}
              >
                Отменить
              </button>
            </div>
          </article>
        ))}
      </div>
    </main>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    pending: { label: 'Ожидает', color: '#eab308' },
    accepted: { label: 'Принята', color: 'var(--color-accent)' },
    ready: { label: 'Готова', color: '#34d399' },
    done: { label: 'Завершена', color: 'var(--secondary)' },
    cancelled: { label: 'Отменена', color: '#f87171' },
  }
  const s = map[status] ?? map.pending
  return (
    <span
      className="small"
      style={{
        display: 'inline-block',
        marginTop: 6,
        fontSize: 11,
        padding: '3px 8px',
        borderRadius: 999,
        color: s.color,
        background: 'color-mix(in srgb, currentColor 12%, transparent)',
      }}
    >
      {s.label}
    </span>
  )
}
