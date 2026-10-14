import { Link, useNavigate } from 'react-router-dom'
import { CLIENT_BRAND } from '../data/defaults'
import { getMyBookings, getStudio } from '../data/store'
import { formatMoney, formatServicePrice } from '../lib/money'
import { useInstall } from '../lib/pwaInstall'
import { useStoreTick } from '../lib/useStoreTick'

function formatDuration(min: number) {
  if (min >= 480 && min % 480 === 0) return `${min / 480} д`
  if (min % 60 === 0) return `${min / 60} ч`
  return `${Math.floor(min / 60)} ч ${min % 60} мин`
}

export default function Home() {
  useStoreTick()
  const studio = getStudio()
  const nav = useNavigate()
  const install = useInstall()
  const bookings = getMyBookings()
  const active = studio.services.filter((s) => s.active)
  const minPrice = active.length ? Math.min(...active.map((s) => s.price)) : 0

  return (
    <main className="safe-bottom shell" style={{ paddingTop: 'var(--s5)' }}>
      <div className="hero-photo">
        <img src={studio.heroImageUrl} alt="Автомобиль студии" fetchPriority="high" draggable={false} />
        <button type="button" className="photo-label" onClick={() => nav('/services')}>
          <div>
            <strong>Записаться</strong>
            <span>Выбрать услугу и время</span>
          </div>
          <div aria-hidden style={{ fontSize: 22, opacity: 0.85 }}>↗</div>
        </button>
      </div>

      <h1 className="h1" style={{ marginTop: 'var(--s6)' }}>
        {studio.name}
      </h1>
      <p className="muted" style={{ marginTop: 'var(--s3)', maxWidth: 420 }}>
        {studio.tagline}
      </p>

      <div className="hero-stats" style={{ marginTop: 'var(--s5)' }}>
        <div className="hero-stat">
          <div className="hero-stat-value">{active.length}</div>
          <div className="hero-stat-label">услуг в прайсе</div>
        </div>
        <div className="hero-stat">
          <div className="hero-stat-value">{studio.bays}</div>
          <div className="hero-stat-label">бокса в работе</div>
        </div>
        <div className="hero-stat wide">
          <div className="hero-stat-value">от {formatMoney(minPrice)}</div>
          <div className="hero-stat-label">за услугу</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 'var(--s10)' }}>
        <h2 className="h2">Услуги</h2>
        <Link to="/services" className="text-link">
          Все услуги
        </Link>
      </div>

      <div className="service-list" style={{ marginTop: 'var(--s4)' }}>
        {active.map((s) => (
          <button key={s.id} type="button" className="service-row" onClick={() => nav(`/book/${s.id}`)}>
            <div style={{ minWidth: 0 }}>
              <div className="service-row-title">{s.title}</div>
              <div className="service-row-desc">
                {formatDuration(s.durationMin)}
                {s.description ? ` — ${s.description}` : ''}
              </div>
            </div>
            <div>
              <div className="service-row-price">
                {formatServicePrice(s.price, s.priceFrom)}
                <span aria-hidden>↗</span>
              </div>
              <div className="service-row-meta" style={{ textAlign: 'right', marginTop: 4 }}>
                Выбрать
              </div>
            </div>
          </button>
        ))}
      </div>

      <h2 className="h2" style={{ marginTop: 'var(--s12)' }}>
        Работы студии
      </h2>
      <div style={{ marginTop: 'var(--s5)', display: 'grid', gap: 'var(--s6)' }}>
        {studio.photos.map((p) => (
          <figure key={p.id} style={{ margin: 0 }}>
            <img className="work-photo" src={p.imageUrl} alt={p.title} loading="lazy" draggable={false} />
            <figcaption className="work-caption">{p.title}</figcaption>
          </figure>
        ))}
      </div>

      <h2 className="h2" style={{ marginTop: 'var(--s12)' }}>
        Запись в студию
      </h2>
      <div className="booking-card" style={{ marginTop: 'var(--s5)' }}>
        <div className="ocean-content">
          <div>
            <h3 className="h3">Свежий вид для вашего авто</h3>
            <p className="muted small" style={{ marginTop: 'var(--s2)' }}>
              Выберите услугу и удобное время — остальное возьмём на себя
            </p>
          </div>
          <button type="button" className="button button-primary booking-time-glow" onClick={() => nav('/services')}>
            Выбрать время
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 'var(--s3)', padding: 'var(--s5)' }}>
        <div style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'center' }}>
          <span
            style={{
              width: 40,
              height: 40,
              borderRadius: 14,
              background: 'var(--color-accent)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M12 2l1.2 3.5L17 7l-3.5 1.2L12 12l-1.2-3.8L7 7l3.8-1.5L12 2Z" />
            </svg>
          </span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Запись с ИИ</div>
            <div className="muted small">Подберёт услугу для автомобиля и покажет актуальное время</div>
          </div>
        </div>
        <button type="button" className="button button-secondary" style={{ width: '100%', marginTop: 'var(--s4)' }} onClick={() => nav('/assistant')}>
          Подобрать услугу ↗
        </button>
      </div>

      <div className="card" style={{ marginTop: 'var(--s3)', padding: 'var(--s5)' }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>{studio.address}</div>
        <div className="muted small" style={{ marginTop: 4 }}>
          {studio.workHours} · {studio.weekends}
        </div>
        <div style={{ display: 'flex', gap: 'var(--s2)', marginTop: 'var(--s4)' }}>
          <a
            className="button button-secondary"
            href={`https://yandex.ru/maps/?text=${encodeURIComponent(studio.address || studio.name)}`}
            target="_blank"
            rel="noreferrer"
          >
            Маршрут ↗
          </a>
          <a
            className="button button-secondary icon-button"
            href={`tel:${studio.phone.replace(/[^\d+]/g, '')}`}
            aria-label={`Позвонить в студию ${studio.phone}`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M6 4h3l2 5-2 1c1 2 3 4 5 5l1-2 5 2v3c0 1-1 2-2 2C10 20 4 14 4 6c0-1 1-2 2-2Z" />
            </svg>
          </a>
        </div>
      </div>

      {!install.installed && (
        <div className="card install-card" style={{ marginTop: 'var(--s8)', padding: 'var(--s6)' }}>
          <div className="ocean-content install-content">
            <div style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'center' }}>
              <img src={studio.logoUrl} alt={`Логотип ${CLIENT_BRAND.shortName}`} className="brand-logo install-app-icon" />
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{CLIENT_BRAND.shortName}</div>
                <div className="muted small">Приложение студии</div>
              </div>
            </div>
            <div>
              <h2 className="h2">
                Студия всегда
                <br />
                под рукой.
              </h2>
              <p className="muted" style={{ marginTop: 'var(--s2)' }}>
                Записывайтесь за несколько касаний, без поиска ссылки и звонков.
              </p>
            </div>
            <Link to="/install" className="button button-primary install-cta">
              <svg width="22" height="22" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true">
                <path d="M224,144v64a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V144a8,8,0,0,1,16,0v56H208V144a8,8,0,0,1,16,0Zm-101.66,5.66a8,8,0,0,0,11.32,0l40-40a8,8,0,0,0-11.32-11.32L136,124.69V32a8,8,0,0,0-16,0v92.69L93.66,98.34a8,8,0,0,0-11.32,11.32Z" />
              </svg>
              Добавить на экран
              <svg width="20" height="20" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true">
                <path d="M221.66,133.66l-72,72a8,8,0,0,1-11.32-11.32L196.69,136H40a8,8,0,0,1,0-16H196.69L138.34,61.66a8,8,0,0,1,11.32-11.32l72,72A8,8,0,0,1,221.66,133.66Z" />
              </svg>
            </Link>
            <p className="muted small">Бесплатно. Установка через браузер.</p>
          </div>
        </div>
      )}

      {bookings.length > 0 && (
        <Link to="/my" className="button button-secondary" style={{ width: '100%', marginTop: 'var(--s3)' }}>
          У меня есть запись · {bookings.length}
        </Link>
      )}
    </main>
  )
}
