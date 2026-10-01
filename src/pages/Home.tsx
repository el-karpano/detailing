import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { getMyBookings, getStudio } from '../data/store'

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const reduce = useReducedMotion()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setVisible(true)
      },
      { threshold: 0.08, rootMargin: '0px 0px 12% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={visible || reduce ? 'reveal-visible' : 'reveal'}
      style={reduce ? undefined : { transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

export default function Home() {
  const studio = getStudio()
  const bookings = getMyBookings()

  return (
    <main className="safe-bottom">
      {/* Hero */}
      <section className="relative h-[72vh] min-h-[520px] w-full overflow-hidden">
        <img
          src={studio.heroImageUrl}
          alt={`${studio.name} — главная`}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-black/10" />

        <div className="absolute inset-x-0 top-0 flex items-center gap-3 p-5">
          <div className="glass flex items-center gap-2 rounded-2xl px-3 py-2">
            <span className="h-8 w-8 rounded-full bg-[#4690FF] text-center text-sm leading-8 font-bold text-white">
              {studio.name.slice(0, 1)}
            </span>
            <div className="leading-tight">
              <div className="text-sm font-semibold">{studio.name}</div>
              <div className="text-[11px] text-white/60">{studio.tagline}</div>
            </div>
          </div>
        </div>

        {/* Glass CTA on hero photo */}
        <motion.div
          className="absolute inset-x-5 bottom-24"
          initial={useReducedMotion() ? false : { y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.5 }}
        >
          <Link to="/services" className="glass-btn block w-full rounded-2xl px-5 py-4 text-center">
            <div className="text-lg font-semibold tracking-wide">Записаться</div>
            <div className="mt-0.5 text-xs text-white/70">Выберите услугу и время</div>
          </Link>
        </motion.div>
      </section>

      {/* About */}
      <section className="mx-auto max-w-lg space-y-4 px-5 py-8">
        <Reveal>
          <h1 className="text-2xl font-bold">О студии</h1>
          <p className="text-[15px] leading-relaxed text-white/75">{studio.description}</p>
        </Reveal>

        <Reveal delay={80}>
          <div className="glass rounded-2xl p-4 text-sm">
            <div className="flex justify-between py-1">
              <span className="text-white/55">Адрес</span>
              <span className="text-right">{studio.address}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-white/55">Часы работы</span>
              <span className="text-right">{studio.workHours}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-white/55">Выходные</span>
              <span className="text-right">{studio.weekends}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-white/55">Телефон</span>
              <a href={`tel:${studio.phone.replace(/\s/g, '')}`} className="text-[#4690FF]">
                {studio.phone}
              </a>
            </div>
          </div>
        </Reveal>

        {/* Info cards */}
        <div className="grid gap-3">
          {studio.infoCards.map((c, i) => (
            <Reveal key={c.id} delay={i * 70}>
              <div className="glass rounded-2xl p-4">
                <div className="font-semibold text-[#4690FF]">{c.title}</div>
                <p className="mt-1 text-sm text-white/70">{c.body}</p>
              </div>
            </Reveal>
          ))}
        </div>

        {/* Services preview */}
        <Reveal>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Услуги</h2>
            <Link to="/services" className="text-sm text-[#4690FF]">
              Все услуги →
            </Link>
          </div>
        </Reveal>
        <div className="space-y-3">
          {studio.services
            .filter((s) => s.active)
            .slice(0, 3)
            .map((s, i) => (
              <Reveal key={s.id} delay={i * 60}>
                <Link
                  to={`/book/${s.id}`}
                  className="glass block rounded-2xl p-4 transition hover:border-white/20"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{s.title}</div>
                      <p className="mt-1 text-sm text-white/65">{s.description}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-semibold text-[#4690FF]">
                        {s.price.toLocaleString('ru-RU')} ₽
                      </div>
                      <div className="text-xs text-white/50">от {Math.round(s.durationMin / 60)} ч</div>
                    </div>
                  </div>
                </Link>
              </Reveal>
            ))}
        </div>

        {/* Photos */}
        <Reveal>
          <h2 className="pt-4 text-xl font-bold">Примеры работ</h2>
        </Reveal>
        <div className="grid grid-cols-1 gap-3">
          {studio.photos.map((p, i) => (
            <Reveal key={p.id} delay={i * 60}>
              <figure className="glass overflow-hidden rounded-2xl">
                <img src={p.imageUrl} alt={p.title} className="h-48 w-full object-cover" loading="lazy" />
                <figcaption className="p-3">
                  <div className="text-sm font-semibold">{p.title}</div>
                  <div className="text-xs text-white/60">{p.caption}</div>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>

        <Reveal>
          <Link
            to="/services"
            className="accent mt-4 block rounded-2xl px-5 py-4 text-center text-base font-semibold"
          >
            Записаться на услугу
          </Link>
        </Reveal>

        {bookings.length > 0 && (
          <Reveal>
            <Link to="/my" className="glass-btn block rounded-2xl px-5 py-3 text-center text-sm">
              У меня есть запись · {bookings.length}
            </Link>
          </Reveal>
        )}
      </section>
    </main>
  )
}
