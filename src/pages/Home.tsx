import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { getMyBookings, getStudio } from '../data/store'
import { LogoMark } from '../components/Layout'

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

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="card p-4">
      <div className="text-3xl font-semibold tracking-tight">{value}</div>
      <div className="mt-1 text-[13px] text-[#A1A1A1]">{label}</div>
    </div>
  )
}

export default function Home() {
  const studio = getStudio()
  const bookings = getMyBookings()
  const minPrice = Math.min(...studio.services.filter((s) => s.active).map((s) => s.price))

  return (
    <main className="safe-bottom">
      {/* Hero */}
      <section className="relative mx-auto max-w-lg px-5 pt-5">
        <div className="relative overflow-hidden rounded-[28px]">
          <img
            src={studio.heroImageUrl}
            alt="Автомобиль студии"
            className="h-[280px] w-full object-cover sm:h-[320px]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/10" />
          <motion.div
            className="absolute inset-x-4 bottom-4"
            initial={useReducedMotion() ? false : { y: 18, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.45 }}
          >
            <Link
              to="/services"
              className="glass-btn flex items-center justify-between rounded-2xl px-5 py-4"
            >
              <div>
                <div className="text-base font-semibold">Записаться</div>
                <div className="mt-0.5 text-xs text-white/65">Выбрать услугу и время</div>
              </div>
              <span className="arrow-up text-xl">↗</span>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Title + stats */}
      <section className="mx-auto max-w-lg px-5 pt-8">
        <Reveal>
          <h1 className="text-[34px] leading-[1.1] font-semibold tracking-tight">{studio.name}</h1>
          <p className="mt-3 max-w-md text-[15px] leading-relaxed text-[#A1A1A1]">{studio.tagline}</p>
        </Reveal>

        <Reveal delay={60}>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Stat value={String(studio.services.filter((s) => s.active).length)} label="услуг в прайсе" />
            <Stat value={String(studio.bays)} label="бокса в работе" />
          </div>
          <div className="card mt-3 flex items-center justify-between p-4">
            <div className="text-2xl font-semibold">
              от {minPrice.toLocaleString('ru-RU')} ₽
            </div>
            <div className="text-[13px] text-[#A1A1A1]">за услугу</div>
          </div>
        </Reveal>
      </section>

      {/* Services */}
      <section className="mx-auto max-w-lg px-5 pt-10">
        <Reveal>
          <div className="flex items-end justify-between">
            <h2 className="text-2xl font-semibold tracking-tight">Услуги</h2>
            <Link to="/services" className="text-sm text-[#A1A1A1] hover:text-white">
              Все услуги
            </Link>
          </div>
        </Reveal>

        <Reveal delay={40}>
          <div className="card mt-4 divide-y divide-[#262626]">
            {studio.services
              .filter((s) => s.active)
              .map((s) => (
                <Link
                  key={s.id}
                  to={`/book/${s.id}`}
                  className="flex items-start justify-between gap-4 p-5 transition hover:bg-white/[0.03]"
                >
                  <div className="min-w-0">
                    <div className="text-[15px] font-semibold">{s.title}</div>
                    <div className="mt-1 text-[13px] leading-snug text-[#A1A1A1]">
                      {formatDuration(s.durationMin)}
                      {s.description ? ` — ${s.description}` : ''}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[15px] font-semibold whitespace-nowrap">
                      {s.price.toLocaleString('ru-RU')} ₽
                    </div>
                    <div className="mt-1 text-[12px] text-[#A1A1A1]">Выбрать</div>
                  </div>
                </Link>
              ))}
          </div>
        </Reveal>
      </section>

      {/* Works */}
      <section className="mx-auto max-w-lg px-5 pt-10">
        <Reveal>
          <h2 className="text-2xl font-semibold tracking-tight">Работы студии</h2>
        </Reveal>
        <div className="mt-4 space-y-5">
          {studio.photos.map((p, i) => (
            <Reveal key={p.id} delay={i * 60}>
              <figure>
                <img
                  src={p.imageUrl}
                  alt={p.title}
                  className="h-[220px] w-full rounded-[24px] object-cover sm:h-[260px]"
                  loading="lazy"
                />
                <figcaption className="mt-2 text-[13px] text-[#A1A1A1]">{p.title}</figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Booking CTA */}
      <section className="mx-auto max-w-lg px-5 pt-12">
        <Reveal>
          <h2 className="text-2xl font-semibold tracking-tight">Запись в студию</h2>
          <div className="card relative mt-4 overflow-hidden p-6">
            <div
              className="pointer-events-none absolute inset-0 opacity-25"
              style={{
                backgroundImage: 'radial-gradient(circle at 100% 0%, #4690FF 0%, transparent 55%)',
              }}
            />
            <div className="relative">
              <h3 className="text-xl font-semibold">Свежий вид для вашего авто</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#A1A1A1]">
                Выберите услугу и удобное время — остальное возьмём на себя
              </p>
              <Link
                to="/services"
                className="accent mt-5 inline-flex w-full items-center justify-between rounded-2xl px-5 py-3.5 text-[15px] font-semibold"
              >
                Выбрать время
                <span className="arrow-up">↗</span>
              </Link>
            </div>
          </div>
        </Reveal>

        <Reveal delay={60}>
          <div className="card mt-3 p-5">
            <div className="flex items-start gap-3">
              <LogoMark size={40} />
              <div>
                <div className="text-[15px] font-semibold">Запись с ИИ</div>
                <p className="mt-1 text-[13px] leading-relaxed text-[#A1A1A1]">
                  Подберёт услугу для автомобиля и покажет актуальное время
                </p>
              </div>
            </div>
            <Link
              to="/assistant"
              className="glass-btn mt-4 flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium"
            >
              Подобрать услугу <span className="arrow-up">↗</span>
            </Link>
          </div>
        </Reveal>
      </section>

      {/* Contacts */}
      <section className="mx-auto max-w-lg px-5 pt-8">
        <Reveal>
          <div className="card space-y-3 p-5">
            <div className="flex items-start gap-3">
              <IconPin />
              <div>
                <div className="text-[15px] font-semibold">{studio.address}</div>
                <div className="mt-1 text-[13px] text-[#A1A1A1]">
                  {studio.workHours}
                  <span className="ml-2">по времени студии</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <a
                href="https://yandex.ru/maps/?text=Москва"
                target="_blank"
                rel="noreferrer"
                className="glass-btn flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm"
              >
                Маршрут <span className="arrow-up">↗</span>
              </a>
              <a
                href={`tel:${studio.phone.replace(/\s/g, '')}`}
                className="glass-btn flex h-11 w-11 items-center justify-center rounded-2xl"
                aria-label="Позвонить"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M6 4h3l2 5-2 1c1 2 3 4 5 5l1-2 5 2v3c0 1-1 2-2 2C10 20 4 14 4 6c0-1 1-2 2-2Z" />
                </svg>
              </a>
            </div>
          </div>
        </Reveal>
      </section>

      {/* PWA */}
      <section className="mx-auto max-w-lg px-5 pt-10">
        <Reveal>
          <div className="card p-6">
            <div className="flex items-center gap-2.5">
              <LogoMark size={36} />
              <div>
                <div className="text-[15px] font-semibold">SGX</div>
                <div className="text-xs text-[#A1A1A1]">Приложение студии</div>
              </div>
            </div>
            <h2 className="mt-5 text-[28px] leading-[1.15] font-semibold tracking-tight">
              Студия всегда
              <br />
              под рукой.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[#A1A1A1]">
              Записывайтесь за несколько касаний, без поиска ссылки и звонков.
            </p>
            <button
              type="button"
              className="accent mt-5 flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-[15px] font-semibold"
              onClick={() => alert('Откройте меню браузера → «Добавить на экран»')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 4v11m0 0 4-4m-4 4-4-4M5 19h14" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Добавить на экран
            </button>
            <p className="mt-3 text-xs text-[#A1A1A1]">Бесплатно. Установка через браузер.</p>
          </div>
        </Reveal>

        {bookings.length > 0 && (
          <Reveal>
            <Link
              to="/my"
              className="glass-btn mt-3 flex items-center justify-between rounded-2xl px-5 py-4 text-sm"
            >
              У меня есть запись · {bookings.length}
              <span className="arrow-up">↗</span>
            </Link>
          </Reveal>
        )}
      </section>
    </main>
  )
}

function formatDuration(min: number) {
  if (min >= 480 && min % 480 === 0) return `${min / 480} д`
  if (min % 60 === 0) return `${min / 60} ч`
  return `${Math.floor(min / 60)} ч ${min % 60} мин`
}

function IconPin() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="mt-0.5">
      <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  )
}
