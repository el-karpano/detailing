import { useNavigate } from 'react-router-dom'
import { getStudio } from '../data/store'

function formatDuration(min: number) {
  if (min >= 480 && min % 480 === 0) return `${min / 480} д`
  if (min % 60 === 0) return `${min / 60} ч`
  return `${Math.floor(min / 60)} ч ${min % 60} мин`
}

export default function Services() {
  const studio = getStudio()
  const nav = useNavigate()
  const services = studio.services.filter((s) => s.active)

  return (
    <main className="safe-bottom shell" style={{ paddingTop: 'var(--s8)' }}>
      <h1 className="h1">Услуги и цены</h1>
      <p className="muted" style={{ marginTop: 'var(--s4)' }}>
        Время включает работу с автомобилем. Стоимость «от» уточняется после осмотра.
      </p>

      <div className="service-list" style={{ marginTop: 'var(--s8)' }}>
        {services.map((s) => (
          <button key={s.id} type="button" className="service-row" onClick={() => nav(`/book/${s.id}`)}>
            <div style={{ minWidth: 0 }}>
              <div className="service-row-title">{s.title}</div>
              <div className="service-row-desc">
                {formatDuration(s.durationMin)} — {s.description}
              </div>
            </div>
            <div className="service-row-price">
              {s.price >= 12000 ? `от ${s.price.toLocaleString('ru-RU')} ₽` : `${s.price.toLocaleString('ru-RU')} ₽`}
              <span aria-hidden>↗</span>
            </div>
          </button>
        ))}
      </div>
    </main>
  )
}
