import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { addBooking, currentOwner, getBookings, getStudio, logout, updateBooking } from '../data/store'
import { bookingStats } from '../lib/booking'
import type { Booking, BookingStatus } from '../types'

export default function OwnerDashboard() {
  const nav = useNavigate()
  const owner = currentOwner()
  const studio = getStudio()
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')

  const bookings = getBookings(studio.id).sort((a, b) =>
    (a.date + a.time).localeCompare(b.date + b.time),
  )

  const stats = useMemo(() => bookingStats(bookings), [bookings])
  const week = useMemo(() => {
    const now = new Date()
    const from = new Date(now)
    from.setDate(now.getDate() - 7)
    return bookings.filter((b) => b.date >= from.toISOString().slice(0, 10) && b.status !== 'cancelled')
  }, [bookings])

  if (!owner) {
    nav('/owner')
    return null
  }

  const today = new Date().toISOString().slice(0, 10)
  const todayList = bookings.filter((b) => b.date === today && b.status !== 'cancelled')

  function ask(q: string) {
    const t = q.toLowerCase()
    if (/(завтр)/.test(t)) {
      const d = new Date()
      d.setDate(d.getDate() + 1)
      const iso = d.toISOString().slice(0, 10)
      const list = bookings.filter((b) => b.date === iso && b.status !== 'cancelled')
      setAnswer(
        list.length
          ? `Завтра ${list.length} запись(и):\n${list.map((b) => `• ${b.time} ${b.serviceName} — ${b.clientName} (${b.car})`).join('\n')}`
          : 'Завтра записей нет.',
      )
      return
    }
    if (/(машин|запис|недел)/.test(t)) {
      setAnswer(`За 7 дней: ${week.length} машин(ы). Из них завершено: ${week.filter((b) => b.status === 'done').length}.`)
      return
    }
    if (/(деньг|выруч|оплат|получен)/.test(t)) {
      setAnswer(
        `Фактически получено: ${stats.money.toLocaleString('ru-RU')} ₽. Запланировано по активным записям: ${stats.planned.toLocaleString('ru-RU')} ₽.`,
      )
      return
    }
    setAnswer('Могу ответить: «Что у меня завтра?», «Сколько машин было на неделе?», «Сколько денег получено?»')
  }

  return (
    <main className="mx-auto max-w-lg space-y-5 px-5 pt-8 pb-10">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Кабинет</h1>
          <p className="mt-1 text-sm text-white/60">{studio.name}</p>
        </div>
        <button
          className="glass-btn rounded-xl px-3 py-2 text-xs"
          onClick={() => {
            logout()
            nav('/owner')
          }}
        >
          Выйти
        </button>
      </header>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Сегодня" value={String(todayList.length)} />
        <Stat label="За 7 дней" value={String(week.length)} />
        <Stat label="Получено" value={`${stats.money.toLocaleString('ru-RU')} ₽`} />
      </div>

      <section className="glass rounded-2xl p-4">
        <h2 className="font-semibold">Помощник владельца</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {['Что у меня завтра?', 'Сколько машин было на неделе?', 'Сколько денег получено?'].map(
            (q) => (
              <button
                key={q}
                type="button"
                onClick={() => {
                  setQuestion(q)
                  ask(q)
                }}
                className="glass-btn rounded-full px-3 py-1.5 text-xs"
              >
                {q}
              </button>
            ),
          )}
        </div>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            ask(question)
          }}
        >
          <input
            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-[#4690FF]"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Вопрос по записям и оплатам"
          />
          <button className="accent rounded-xl px-4 py-2 text-sm">Спросить</button>
        </form>
        {answer && (
          <p className="mt-3 whitespace-pre-line rounded-xl bg-white/5 p-3 text-sm text-white/85">
            {answer}
          </p>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Ближайшие записи</h2>
          <Link to="/owner/bookings" className="text-sm text-[#4690FF]">
            Все →
          </Link>
        </div>
        <div className="mt-3 space-y-2">
          {bookings
            .filter((b) => b.status !== 'cancelled' && b.status !== 'done')
            .slice(0, 6)
            .map((b) => (
              <OwnerBookingRow key={b.id} booking={b} onChange={() => nav(0)} />
            ))}
          {bookings.filter((b) => b.status !== 'cancelled' && b.status !== 'done').length === 0 && (
            <p className="text-sm text-white/50">Активных записей нет</p>
          )}
        </div>
      </section>

      <button
        className="glass-btn w-full rounded-2xl px-4 py-3 text-sm"
        onClick={() => {
          const name = prompt('Имя клиента')
          if (!name) return
          const phone = prompt('Телефон') ?? ''
          const date = prompt('Дата (ГГГГ-ММ-ДД)', today) ?? today
          const time = prompt('Время (ЧЧ:ММ)', '12:00') ?? '12:00'
          const svc = studio.services[0]
          const r = addBooking({
            id: crypto.randomUUID(),
            studioId: studio.id,
            serviceId: svc.id,
            serviceName: svc.title,
            clientName: name,
            phone,
            car: prompt('Автомобиль') ?? '—',
            date,
            time,
            bay: 1,
            status: 'accepted',
            price: svc.price,
            paid: 0,
            createdAt: new Date().toISOString(),
            reminderEnabled: false,
          })
          if (!r.ok) alert(r.error)
          else nav(0)
        }}
      >
        + Добавить запись вручную
      </button>

      <nav className="grid grid-cols-2 gap-2">
        <Link to="/owner/bookings" className="glass-btn rounded-2xl px-4 py-3 text-center text-sm">
          Записи и оплаты
        </Link>
        <Link to="/owner/settings" className="glass-btn rounded-2xl px-4 py-3 text-center text-sm">
          Настройки студии
        </Link>
      </nav>
    </main>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-2xl p-3">
      <div className="text-xs text-white/55">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  )
}

export function OwnerBookingRow({
  booking,
  onChange,
}: {
  booking: Booking
  onChange: () => void
}) {
  return (
    <div className="glass rounded-2xl p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">
            {booking.time} · {booking.serviceName}
          </div>
          <div className="text-xs text-white/60">
            {booking.date} · бокс {booking.bay} · {booking.clientName} · {booking.car}
          </div>
        </div>
        <div className="text-right text-sm font-semibold text-[#4690FF]">
          {booking.price.toLocaleString('ru-RU')} ₽
          <div className="text-[11px] text-white/50">опл. {booking.paid.toLocaleString('ru-RU')} ₽</div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {(
          [
            ['accepted', 'Принята'],
            ['ready', 'Готова'],
            ['done', 'Завершена'],
            ['cancelled', 'Отмена'],
          ] as [BookingStatus, string][]
        ).map(([s, label]) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              updateBooking(booking.id, { status: s })
              onChange()
            }}
            className={`rounded-lg px-2 py-1 text-[11px] ${
              booking.status === s ? 'accent' : 'glass-btn'
            }`}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          className="glass-btn rounded-lg px-2 py-1 text-[11px]"
          onClick={() => {
            const v = prompt('Оплата, ₽', String(booking.paid))
            if (v == null) return
            updateBooking(booking.id, { paid: Number(v) || 0 })
            onChange()
          }}
        >
          Оплата
        </button>
      </div>
    </div>
  )
}
