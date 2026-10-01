import { Link } from 'react-router-dom'
import { getStudio } from '../data/store'

function formatDuration(min: number) {
  if (min >= 480 && min % 480 === 0) return `${min / 480} д`
  if (min % 60 === 0) return `${min / 60} ч`
  return `${Math.floor(min / 60)} ч ${min % 60} мин`
}

export default function Services() {
  const studio = getStudio()
  const services = studio.services.filter((s) => s.active)

  return (
    <main className="safe-bottom mx-auto max-w-lg px-5 pt-8">
      <h1 className="text-[34px] leading-[1.1] font-semibold tracking-tight">Услуги и цены</h1>
      <p className="mt-4 text-[15px] leading-relaxed text-[#A1A1A1]">
        Время включает работу с автомобилем. Стоимость «от» уточняется после осмотра.
      </p>

      <div className="card mt-8 divide-y divide-[#262626]">
        {services.map((s) => (
          <Link
            key={s.id}
            to={`/book/${s.id}`}
            className="flex items-start justify-between gap-4 p-5 transition hover:bg-white/[0.03]"
          >
            <div className="min-w-0">
              <div className="text-[15px] font-semibold">{s.title}</div>
              <div className="mt-1 text-[13px] leading-snug text-[#A1A1A1]">
                {formatDuration(s.durationMin)} — {s.description}
              </div>
            </div>
            <div className="shrink-0 pt-1 text-right">
              <div className="flex items-center justify-end gap-2">
                <span className="text-[15px] font-semibold whitespace-nowrap">
                  {s.price.toLocaleString('ru-RU')} ₽
                </span>
                <span className="arrow-up text-lg">↗</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  )
}
