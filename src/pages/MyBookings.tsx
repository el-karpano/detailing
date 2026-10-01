import { useLocation, useNavigate } from 'react-router-dom'
import { getMyBookings, getStudio, updateBooking } from '../data/store'

export default function MyBookings() {
  const studio = getStudio()
  const nav = useNavigate()
  const loc = useLocation()
  const justBooked = (loc.state as { justBooked?: string } | null)?.justBooked

  const bookings = getMyBookings().sort((a, b) =>
    (a.date + a.time).localeCompare(b.date + b.time),
  )

  return (
    <main className="safe-bottom mx-auto max-w-lg px-5 pt-8 pb-6">
      <h1 className="text-2xl font-bold">Моя запись</h1>
      <p className="mt-1 text-sm text-white/60">Ваши визиты в {studio.name}</p>

      {justBooked && (
        <div className="glass mt-4 rounded-2xl border-[#4690FF]/40 p-4">
          <div className="font-semibold text-[#4690FF]">Запись подтверждена</div>
          <p className="mt-1 text-sm text-white/70">
            Мы сохранили ваш визит. Возле времени будет видно, если оно занято другим клиентом.
          </p>
        </div>
      )}

      {bookings.length === 0 && (
        <div className="glass mt-5 rounded-2xl p-6 text-center">
          <p className="text-white/65">Пока нет записей</p>
          <button
            onClick={() => nav('/services')}
            className="accent mt-4 rounded-2xl px-5 py-3 text-sm font-semibold"
          >
            Выбрать услугу
          </button>
        </div>
      )}

      <div className="mt-5 space-y-3">
        {bookings.map((b) => (
          <article key={b.id} className="glass rounded-2xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold">{b.serviceName}</div>
                <div className="mt-1 text-sm text-white/70">
                  {b.date} · {b.time} · бокс {b.bay}
                </div>
                <div className="mt-1 text-sm text-white/55">
                  {b.clientName} · {b.car}
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-[#4690FF]">
                  {b.price.toLocaleString('ru-RU')} ₽
                </div>
                <StatusBadge status={b.status} />
              </div>
            </div>
            {b.reminderEnabled && (
              <div className="mt-2 text-xs text-white/45">Напоминание за сутки включено</div>
            )}
            <div className="mt-3 flex gap-2">
              <button
                className="glass-btn rounded-xl px-3 py-2 text-xs"
                onClick={() => {
                  const ics = [
                    'BEGIN:VCALENDAR',
                    'VERSION:2.0',
                    'BEGIN:VEVENT',
                    `DTSTART:${b.date.replace(/-/g, '')}T${b.time.replace(':', '')}00`,
                    `SUMMARY:${b.serviceName}`,
                    `DESCRIPTION:${studio.name}`,
                    `LOCATION:${studio.address}`,
                    'END:VEVENT',
                    'END:VCALENDAR',
                  ].join('\n')
                  const blob = new Blob([ics], { type: 'text/calendar' })
                  const a = document.createElement('a')
                  a.href = URL.createObjectURL(blob)
                  a.download = `visit-${b.date}-${b.time}.ics`
                  a.click()
                }}
              >
                В календарь
              </button>
              <button
                className="rounded-xl border border-red-500/30 px-3 py-2 text-xs text-red-200"
                onClick={() => {
                  if (confirm('Отменить запись?')) {
                    updateBooking(b.id, { status: 'cancelled' })
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
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: 'Ожидает', cls: 'bg-yellow-500/15 text-yellow-200' },
    accepted: { label: 'Принята', cls: 'bg-[#4690FF]/15 text-[#8db8ff]' },
    ready: { label: 'Готова', cls: 'bg-emerald-500/15 text-emerald-200' },
    done: { label: 'Завершена', cls: 'bg-white/10 text-white/70' },
    cancelled: { label: 'Отменена', cls: 'bg-red-500/15 text-red-200' },
  }
  const s = map[status] ?? map.pending
  return <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] ${s.cls}`}>{s.label}</span>
}
