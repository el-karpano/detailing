import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getBookings, getSchedule, getStudio } from '../data/store'
import { buildSlots } from '../lib/booking'

type Msg = { role: 'user' | 'bot'; text: string }

const SUGGESTIONS = [
  'Когда ближайшее окно?',
  'Сколько стоит полировка?',
  'Как найти студию?',
  'Что входит в керамику?',
]

export default function Assistant() {
  const studio = getStudio()
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: 'bot',
      text: `Здравствуйте! Я помощник ${studio.name}. Отвечу по услугам, ценам и свободному времени. Спросите, например: «Когда ближайшее окно?»`,
    },
  ])
  const listRef = useRef<HTMLDivElement>(null)

  const bookings = getBookings(studio.id)
  const schedule = getSchedule()

  const answer = useMemo(() => {
    return (q: string): string => {
      const t = q.toLowerCase().trim()

      if (!t) return 'Напишите вопрос текстом или выберите подсказку ниже.'

      if (/(стоим|цен[аыу]|сколько стоит|прайс)/.test(t)) {
        const found = studio.services.find((s) =>
          s.title.toLowerCase().split(/\s+/).some((w) => t.includes(w.slice(0, 5))),
        )
        if (found) {
          return `${found.title} — ${found.price.toLocaleString('ru-RU')} ₽. Длительность ≈ ${Math.round((found.durationMin / 60) * 10) / 10} ч. ${found.description}`
        }
        const list = studio.services
          .filter((s) => s.active)
          .map((s) => `• ${s.title} — ${s.price.toLocaleString('ru-RU')} ₽`)
          .join('\n')
        return `Цены студии:\n${list}`
      }

      if (/(когда|ближайш|свободн|окно|записа)/.test(t)) {
        for (const day of schedule.filter((d) => !d.closed)) {
          const svc = studio.services.find((s) => s.active)
          if (!svc) break
          const slots = buildSlots(studio, schedule, bookings, svc, day.date)
          const free = slots.filter((s) => s.available)
          if (free.length > 0) {
            const times = free
              .slice(0, 5)
              .map((s) => s.time)
              .join(', ')
            return `Ближайшее свободное окно: ${day.date} в ${free[0].time}. Ещё слоты того дня: ${times}. Записаться можно в разделе «Услуги».`
          }
        }
        return 'К сожалению, на ближайшие дни свободных окон нет. Попробуйте другую услугу или напишите владельцу.'
      }

      if (/(где|адрес|найти|как добраться|проезд)/.test(t)) {
        return `Мы находимся: ${studio.address}. Часы работы: ${studio.workHours}. ${studio.weekends}. Телефон: ${studio.phone}.`
      }

      if (/(керамик|покрыти|защит)/.test(t)) {
        const s = studio.services.find((x) => x.title.toLowerCase().includes('керам'))
        return s
          ? `${s.title}: ${s.description} Цена ${s.price.toLocaleString('ru-RU')} ₽, длительность ≈ ${Math.round((s.durationMin / 60) * 10) / 10} ч.`
          : 'Уточните, какая защита кузова вас интересует.'
      }

      if (/(полир|царапин|блеск)/.test(t)) {
        const s = studio.services.find((x) => x.title.toLowerCase().includes('полир'))
        return s
          ? `${s.title}: ${s.description} Цена ${s.price.toLocaleString('ru-RU')} ₽.`
          : 'Уточните детали по полировке — подскажу подходящую услугу.'
      }

      if (/(отмен|перенест)/.test(t)) {
        return `Отмена — ${studio.cancelPolicy.toLowerCase()} Отменить или перенести можно в разделе «Моя запись».`
      }

      return 'Не совсем понял вопрос. Уточните: услугу, цену, свободное время, адрес или правила отмены. Могу подсказать по конкретной услуге из списка.'
    }
  }, [studio, schedule, bookings])

  function send(text: string) {
    const q = text.trim()
    if (!q) return
    const reply = answer(q)
    setMessages((m) => [...m, { role: 'user', text: q }, { role: 'bot', text: reply }])
    setInput('')
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
    })
  }

  return (
    <main className="safe-bottom mx-auto flex max-w-lg flex-col px-5 pt-8 pb-6">
      <h1 className="text-2xl font-bold">Помощник</h1>
      <p className="mt-1 text-sm text-white/60">
        Отвечает по услугам, ценам и свободному времени студии
      </p>

      <div
        ref={listRef}
        className="glass mt-4 flex max-h-[52vh] min-h-[280px] flex-col gap-3 overflow-y-auto rounded-2xl p-4"
      >
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
              m.role === 'user'
                ? 'self-end bg-[#4690FF] text-white'
                : 'self-start bg-white/8 text-white/90'
            }`}
          >
            <div className="whitespace-pre-line">{m.text}</div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => send(s)}
            className="glass-btn rounded-full px-3 py-1.5 text-xs text-white/85"
          >
            {s}
          </button>
        ))}
      </div>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          send(input)
        }}
      >
        <input
          className="glass flex-1 rounded-2xl px-4 py-3 outline-none focus:border-[#4690FF]"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Спросите про услугу или время"
          aria-label="Вопрос помощнику"
        />
        <button type="submit" className="accent rounded-2xl px-5 py-3 font-semibold">
          →
        </button>
      </form>

      <Link to="/services" className="mt-4 text-center text-sm text-[#4690FF]">
        Перейти к записи
      </Link>
    </main>
  )
}
