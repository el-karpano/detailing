import { Link } from 'react-router-dom'
import { getStudio } from '../data/store'

export default function Services() {
  const studio = getStudio()
  const services = studio.services.filter((s) => s.active)

  return (
    <main className="safe-bottom mx-auto max-w-lg px-5 pt-8 pb-6">
      <h1 className="text-2xl font-bold">Услуги</h1>
      <p className="mt-1 text-sm text-white/60">Выберите услугу, чтобы перейти к записи</p>

      <div className="mt-5 space-y-3">
        {services.map((s) => (
          <Link
            key={s.id}
            to={`/book/${s.id}`}
            className="glass block rounded-2xl p-4 transition hover:border-white/20"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold">{s.title}</div>
                <p className="mt-1 text-sm text-white/65">{s.description}</p>
                <div className="mt-2 text-xs text-white/45">
                  Длительность ≈ {Math.round(s.durationMin / 60 * 10) / 10} ч
                  {studio.prepMin > 0 && ` + ${studio.prepMin} мин подготовка`}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-lg font-semibold text-[#4690FF]">
                  {s.price.toLocaleString('ru-RU')} ₽
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  )
}
