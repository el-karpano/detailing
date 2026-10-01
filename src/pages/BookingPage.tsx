import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { addBooking, getBookings, getSchedule, getStudio, markMyBooking } from '../data/store'
import { buildSlots } from '../lib/booking'
import type { Booking } from '../types'

export default function BookingPage() {
  const { serviceId } = useParams()
  const nav = useNavigate()
  const studio = getStudio()
  const service = studio.services.find((s) => s.id === serviceId)

  const [date, setDate] = useState(() => getSchedule().find((d) => !d.closed)?.date ?? '')
  const [time, setTime] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [car, setCar] = useState('')
  const [error, setError] = useState('')
  const [reminder, setReminder] = useState(true)

  const schedule = getSchedule()
  const bookings = getBookings(studio.id)

  const slots = useMemo(() => {
    if (!service || !date) return []
    return buildSlots(studio, schedule, bookings, service, date)
  }, [service, date, schedule, bookings, studio])

  if (!service) {
    return (
      <main className="safe-bottom mx-auto max-w-lg px-5 pt-10">
        <p>Услуга не найдена.</p>
        <Link to="/services" className="text-[#4690FF]">
          ← К услугам
        </Link>
      </main>
    )
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!date || !time) {
      setError('Выберите дату и свободное время')
      return
    }
    if (!name.trim() || phone.trim().length < 6) {
      setError('Укажите имя и телефон')
      return
    }

    const slot = slots.find((s) => s.time === time)
    const booking: Booking = {
      id: crypto.randomUUID(),
      studioId: studio.id,
      serviceId: service!.id,
      serviceName: service!.title,
      clientName: name.trim(),
      phone: phone.trim(),
      car: car.trim() || '—',
      date,
      time,
      bay: slot?.bay ?? 1,
      status: 'pending',
      price: service!.price,
      paid: 0,
      createdAt: new Date().toISOString(),
      reminderEnabled: reminder,
    }

    const result = addBooking(booking)
    if (!result.ok) {
      setError(result.error)
      return
    }
    markMyBooking(result.booking.id)
    nav('/my', { state: { justBooked: result.booking.id } })
  }

  return (
    <main className="safe-bottom mx-auto max-w-lg px-5 pt-8 pb-6">
      <Link to="/services" className="text-sm text-white/55">
        ← Назад
      </Link>
      <h1 className="mt-2 text-2xl font-bold">Запись в студию</h1>
      <div className="glass mt-4 rounded-2xl p-4">
        <div className="font-semibold">{service.title}</div>
        <div className="mt-1 text-sm text-white/65">{service.description}</div>
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className="text-white/55">Цена</span>
          <span className="font-semibold text-[#4690FF]">
            {service.price.toLocaleString('ru-RU')} ₽
          </span>
        </div>
      </div>

      <form onSubmit={submit} className="mt-5 space-y-5">
        <section>
          <h2 className="mb-2 text-sm font-semibold text-white/70">Дата</h2>
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
            {schedule.map((d) => {
              const disabled = d.closed
              return (
                <button
                  key={d.date}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    setDate(d.date)
                    setTime('')
                  }}
                  className={`shrink-0 rounded-xl px-3 py-2 text-sm ${
                    date === d.date
                      ? 'accent font-semibold'
                      : disabled
                        ? 'border border-white/10 text-white/30'
                        : 'glass-btn'
                  }`}
                >
                  {d.date.slice(5)}
                  {disabled && <div className="text-[10px]">выходной</div>}
                </button>
              )
            })}
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-white/70">
            Свободное время
            <span className="ml-2 text-xs font-normal text-white/45">
              занято отмечено серым
            </span>
          </h2>
          <div className="grid grid-cols-4 gap-2">
            {slots.length === 0 && (
              <p className="col-span-4 text-sm text-white/50">Нет слотов на эту дату</p>
            )}
            {slots.map((s) => (
              <button
                key={s.time}
                type="button"
                disabled={!s.available}
                onClick={() => setTime(s.time)}
                className={`rounded-xl px-2 py-2 text-sm ${
                  time === s.time
                    ? 'accent font-semibold'
                    : s.available
                      ? 'glass-btn slot-available'
                      : 'glass-btn slot-busy cursor-not-allowed'
                }`}
              >
                {s.time}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div>
            <label className="mb-1 block text-sm text-white/70" htmlFor="name">
              Имя
            </label>
            <input
              id="name"
              className="glass w-full rounded-xl px-3 py-3 outline-none focus:border-[#4690FF]"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Как к вам обращаться"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-white/70" htmlFor="phone">
              Телефон
            </label>
            <input
              id="phone"
              type="tel"
              className="glass w-full rounded-xl px-3 py-3 outline-none focus:border-[#4690FF]"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+7 ..."
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-white/70" htmlFor="car">
              Автомобиль
            </label>
            <input
              id="car"
              className="glass w-full rounded-xl px-3 py-3 outline-none focus:border-[#4690FF]"
              value={car}
              onChange={(e) => setCar(e.target.value)}
              placeholder="Марка, модель, цвет"
            />
          </div>
        </section>

        <label className="flex items-center gap-2 text-sm text-white/70">
          <input
            type="checkbox"
            checked={reminder}
            onChange={(e) => setReminder(e.target.checked)}
            className="h-4 w-4 accent-[#4690FF]"
          />
          Напомнить за сутки до визита
        </label>

        {error && (
          <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        )}

        <button type="submit" className="accent w-full rounded-2xl px-5 py-4 text-base font-semibold">
          Подтвердить запись
        </button>

        <p className="text-xs text-white/45">{studio.cancelPolicy}</p>
      </form>
    </main>
  )
}
