import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getBookings, getSchedule, getStudio } from '../data/store'
import { buildSlots } from '../lib/booking'

type Msg = { role: 'user' | 'assistant'; text: string }
type BookAction = { serviceId: string; date?: string; time?: string }

const SUGGESTIONS = [
  'Подбери услугу для мойки кузова',
  'Когда ближайшее окно?',
  'Сколько стоит полировка?',
  'Хочу убрать запах в салоне',
]

function stripMd(text: string) {
  let t = text
    .replace(/\r/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*•]\s+/gm, '• ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n?ACTION:\s*\{[\s\S]*?\}\s*$/i, '')
    .trim()

  // страховка: вырезаем chain-of-thought, если вдруг просочился
  const noise =
    /^(let me|i should|i need|i'll|i will|i think|the user|actually|now i|now let|in summary|to summarize|hmm|wait,|based on|this way|i'll recommend|i'll keep|i'll propose|i'll say|guidance|instruction)\b/im
  t = t
    .split('\n')
    .filter((line) => {
      const s = line.trim()
      if (!s) return true
      return !noise.test(s)
    })
    .join('\n')

  return t.trim()
}

function freeSlotsPreview() {
  const studio = getStudio()
  const schedule = getSchedule()
  const bookings = getBookings(studio.id)
  const out: { date: string; times: string[] }[] = []
  for (const day of schedule.filter((d) => !d.closed)) {
    const times = new Set<string>()
    for (const svc of studio.services.filter((s) => s.active)) {
      for (const slot of buildSlots(studio, schedule, bookings, svc, day.date)) {
        if (slot.available) times.add(slot.time)
      }
    }
    if (times.size) {
      out.push({ date: day.date, times: [...times].sort().slice(0, 10) })
      if (out.length >= 6) break
    }
  }
  return out
}

/** Fallback: если модель не отдала ACTION — вытащим услугу/время из текста. */
function guessAction(text: string): BookAction | null {
  const studio = getStudio()
  const lower = text.toLowerCase()
  const svc = studio.services.find(
    (s) => s.active && lower.includes(s.title.toLowerCase().split(/[\s«»(),.-]+/)[0] || '___'),
  )
  if (!svc) return null
  const time = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/)?.[0]
  const date = text.match(/\b(\d{4}-\d{2}-\d{2})\b/)?.[0]
  return { serviceId: svc.id, date, time }
}

export default function Assistant() {
  const studio = getStudio()
  const nav = useNavigate()
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [action, setAction] = useState<BookAction | null>(null)
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: 'assistant',
      text: `Здравствуйте! Я помощник ${studio.name}. Подберу услугу и помогу записаться. Расскажите, что нужно с автомобилем.`,
    },
  ])
  const listRef = useRef<HTMLDivElement>(null)

  const scrollDown = () => {
    requestAnimationFrame(() => {
      const el = listRef.current
      if (el) el.scrollTop = el.scrollHeight
    })
  }

  useEffect(() => {
    scrollDown()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages])

  async function send(text: string) {
    const q = text.trim()
    if (!q || busy) return
    setInput('')
    setError('')
    setBusy(true)
    setAction(null)
    const next: Msg[] = [...messages, { role: 'user', text: q }]
    setMessages(next)

    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), 55000)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text })),
          studio: {
            name: studio.name,
            address: studio.address,
            phone: studio.phone,
            workHours: studio.workHours,
            weekends: studio.weekends,
            cancelPolicy: studio.cancelPolicy,
            currency: (studio as { currency?: string }).currency ?? 'Br',
            services: studio.services.filter((s) => s.active),
          },
          freeSlots: freeSlotsPreview(),
        }),
      })

      const data = (await res.json().catch(() => ({}))) as {
        reply?: string
        error?: string
        action?: BookAction | null
      }

      if (!res.ok) {
        throw new Error(data.error || `Ошибка ${res.status}`)
      }

      const reply = stripMd(data.reply || 'Не удалось получить ответ. Попробуйте ещё раз.')
      setMessages((m) => [...m, { role: 'assistant', text: reply }])

      const act = data.action?.serviceId ? data.action : guessAction(reply)
      if (act?.serviceId) setAction(act)
    } catch (e) {
      const msg =
        e instanceof Error && e.name === 'AbortError'
          ? 'Слишком долго думаем. Попробуйте ещё раз или перейдите в «Услуги».'
          : 'Нет связи с помощником. Попробуйте ещё раз или перейдите в «Услуги».'
      setError(msg)
      setMessages((m) => [...m, { role: 'assistant', text: msg }])
    } finally {
      window.clearTimeout(timer)
      setBusy(false)
      scrollDown()
    }
  }

  function goBook() {
    if (!action) return
    const q = new URLSearchParams()
    if (action.date) q.set('date', action.date)
    if (action.time) q.set('time', action.time)
    nav(`/book/${action.serviceId}?${q.toString()}`)
  }

  return (
    <main
      className="assistant-shell shell"
      style={{
        paddingTop: 'var(--s5)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--s3)',
      }}
    >
      <div>
        <h1 className="h1">Запись с ИИ</h1>
        <p className="muted" style={{ marginTop: 'var(--s2)' }}>
          Подберёт услугу и покажет свободное время
        </p>
      </div>

      <div
        ref={listRef}
        className="booking-card assistant-log"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--s3)',
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          padding: 'var(--s4)',
          minHeight: 180,
          maxHeight: 'min(52vh, 420px)',
        }}
      >
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              maxWidth: '88%',
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              borderRadius: 16,
              padding: '10px 14px',
              fontSize: 14,
              lineHeight: 1.55,
              whiteSpace: 'pre-line',
              background: m.role === 'user' ? 'var(--color-accent)' : 'var(--overlay)',
              color: 'var(--ink)',
            }}
          >
            {m.text}
          </div>
        ))}
        {busy && (
          <div
            style={{
              alignSelf: 'flex-start',
              borderRadius: 16,
              padding: '10px 14px',
              fontSize: 14,
              background: 'var(--overlay)',
              color: 'var(--secondary)',
              display: 'flex',
              gap: 6,
              alignItems: 'center',
            }}
            aria-live="polite"
          >
            <span>Помощник отвечает</span>
            <span style={{ opacity: 0.6 }}>···</span>
          </div>
        )}
      </div>

      {messages.length <= 2 && (
        <div
          className="chip-scroll"
          style={{ display: 'flex', gap: 'var(--s2)', overflowX: 'auto' }}
        >
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              className="button button-ghost"
              style={{
                borderRadius: 999,
                padding: '8px 12px',
                fontSize: 12,
                flex: '0 0 auto',
                whiteSpace: 'nowrap',
                minHeight: 40,
              }}
              onClick={() => void send(s)}
              disabled={busy}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        style={{ display: 'flex', gap: 'var(--s2)' }}
        onSubmit={(e) => {
          e.preventDefault()
          void send(input)
        }}
      >
        <input
          className="input"
          style={{ flex: 1 }}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Расскажите про автомобиль"
          aria-label="Вопрос помощнику"
          disabled={busy}
        />
        <button type="submit" className="button button-primary" style={{ width: 52, minHeight: 52, flexShrink: 0 }} disabled={busy || !input.trim()} aria-label="Отправить">
          →
        </button>
      </form>

      {error && (
        <button type="button" className="button button-secondary" onClick={() => void send(messages[messages.length - 2]?.text || messages[0].text)}>
          Попробовать ещё раз
        </button>
      )}

      {action ? (
        <button type="button" className="button button-primary" style={{ width: '100%', padding: '14px 18px', fontSize: 15 }} onClick={goBook}>
          Записаться{action.date ? ` · ${action.date.slice(5).split('-').reverse().join('.')}` : ''}
          {action.time ? ` ${action.time}` : ''}
        </button>
      ) : (
        <button type="button" className="button button-secondary" onClick={() => nav('/services')}>
          Перейти к записи
        </button>
      )}
    </main>
  )
}
