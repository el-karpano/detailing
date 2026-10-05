import { useState } from 'react'
import { Link } from 'react-router-dom'
import { INSTALL_GUIDES, detectPlatform, useInstall, type Platform } from '../lib/pwaInstall'

function StepIcon({ name }: { name: string }) {
  const common = { width: 22, height: 22, fill: 'currentColor', viewBox: '0 0 256 256', 'aria-hidden': true as const }
  if (name === 'share') {
    return (
      <svg {...common}>
        <path d="M224,144v64a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V144a8,8,0,0,1,16,0v56H208V144a8,8,0,0,1,16,0Zm-101.66,5.66a8,8,0,0,0,11.32,0l40-40a8,8,0,0,0-11.32-11.32L136,124.69V32a8,8,0,0,0-16,0v92.69L93.66,98.34a8,8,0,0,0-11.32,11.32Z" />
      </svg>
    )
  }
  if (name === 'plus') {
    return (
      <svg {...common}>
        <path d="M208,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32Zm0,176H48V48H208V208Zm-32-80a8,8,0,0,1-8,8H136v32a8,8,0,0,1-16,0V136H88a8,8,0,0,1,0-16h32V88a8,8,0,0,1,16,0v32h32A8,8,0,0,1,176,128Z" />
      </svg>
    )
  }
  if (name === 'check') {
    return (
      <svg {...common}>
        <path d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z" />
      </svg>
    )
  }
  if (name === 'menu') {
    return (
      <svg {...common}>
        <path d="M128,76a20,20,0,1,0,20,20A20,20,0,0,0,128,76Zm0-32a20,20,0,1,0,20,20A20,20,0,0,0,128,44Zm0,96a20,20,0,1,0,20,20A20,20,0,0,0,128,140Z" />
      </svg>
    )
  }
  if (name === 'device') {
    return (
      <svg {...common}>
        <path d="M176,16H80A24,24,0,0,0,56,40V216a24,24,0,0,0,24,24h96a24,24,0,0,0,24-24V40A24,24,0,0,0,176,16ZM72,64H184V192H72Zm8-32h96a8,8,0,0,1,8,8v8H72V40A8,8,0,0,1,80,32Zm96,192H80a8,8,0,0,1-8-8v-8H184v8A8,8,0,0,1,176,224Z" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm48-88a8,8,0,0,1-8,8H136v32a8,8,0,0,1-16,0V136H88a8,8,0,0,1,0-16h32V88a8,8,0,0,1,16,0v32h32A8,8,0,0,1,176,128Z" />
    </svg>
  )
}

export default function Install() {
  const { installed, available, busy, message, install } = useInstall()
  const [platform, setPlatform] = useState<Platform>(() => detectPlatform())
  const [copyMsg, setCopyMsg] = useState('')

  const studioUrl = `${window.location.origin}${window.location.pathname.replace(/install\/?$/, '')}`

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(studioUrl.endsWith('/') ? studioUrl : `${studioUrl}/`)
      setCopyMsg('Ссылка скопирована')
    } catch {
      setCopyMsg(`Скопируйте адрес: ${studioUrl}`)
    }
  }

  return (
    <main className="safe-bottom shell install-guide" style={{ paddingTop: 'var(--s5)', display: 'flex', flexDirection: 'column', gap: 'var(--s6)' }}>
      <Link to="/" className="text-link" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--s2)', alignSelf: 'flex-start' }}>
        <svg width="20" height="20" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true">
          <path d="M224,128a8,8,0,0,1-8,8H59.31l58.35,58.34a8,8,0,0,1-11.32,11.32l-72-72a8,8,0,0,1,0-11.32l72-72a8,8,0,0,1,11.32,11.32L59.31,120H216A8,8,0,0,1,224,128Z" />
        </svg>
        На главную
      </Link>

      <div className="booking-card install-card install-guide-hero" style={{ marginBottom: 0 }}>
        <div className="ocean-content install-content">
          <div style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'center' }}>
            <img src="/assets/logo.svg" alt="Логотип SGX" className="brand-logo install-app-icon" />
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>SGX</div>
              <div className="muted small">Приложение студии</div>
            </div>
          </div>

          <div>
            <h1 className="h1">{installed ? 'Приложение установлено' : 'Добавьте студию на главный экран'}</h1>
            <p className="muted" style={{ marginTop: 'var(--s3)' }}>
              Своя иконка на устройстве. Быстрый доступ к услугам и вашей записи.
            </p>
          </div>

          {installed ? (
            <Link to="/my" className="button button-primary">
              Моя запись
              <svg width="20" height="20" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true">
                <path d="M221.66,133.66l-72,72a8,8,0,0,1-11.32-11.32L196.69,136H40a8,8,0,0,1,0-16H196.69L138.34,61.66a8,8,0,0,1,11.32-11.32l72,72A8,8,0,0,1,221.66,133.66Z" />
              </svg>
            </Link>
          ) : available || busy ? (
            <button type="button" className="button button-primary" onClick={() => void install()} disabled={busy}>
              <svg width="22" height="22" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true">
                <path d="M224,144v64a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V144a8,8,0,0,1,16,0v56H208V144a8,8,0,0,1,16,0Zm-101.66,5.66a8,8,0,0,0,11.32,0l40-40a8,8,0,0,0-11.32-11.32L136,124.69V32a8,8,0,0,0-16,0v92.69L93.66,98.34a8,8,0,0,0-11.32,11.32Z" />
              </svg>
              {busy ? 'Открываем установку…' : 'Установить сейчас'}
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 'var(--s2)', alignItems: 'center' }}>
              <StepIcon name="device" />
              <span className="muted">Несколько шагов в браузере — и готово</span>
            </div>
          )}
        </div>
      </div>

      {message && (
        <p className="muted small" role="status">
          {message}
        </p>
      )}

      {!installed && (
        <>
          <div>
            <h2 className="h2">Как установить</h2>
            <div
              className="install-devices"
              style={{ display: 'flex', gap: 'var(--s1)', marginTop: 'var(--s3)' }}
              aria-label="Ваше устройство"
            >
              {(
                [
                  ['ios', 'iPhone / iPad'],
                  ['android', 'Android'],
                  ['desktop', 'Компьютер'],
                ] as [Platform, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className="button button-ghost"
                  aria-pressed={platform === key}
                  onClick={() => setPlatform(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <ol className="install-steps">
            {INSTALL_GUIDES[platform].map((step, i) => (
              <li
                key={`${platform}-${i}`}
                className="install-step"
                style={{ display: 'flex', gap: 'var(--s4)', alignItems: 'flex-start' }}
              >
                <span className="install-step-number" aria-hidden>
                  {i + 1}
                </span>
                <div style={{ flex: '1 1 0%', minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 'var(--s2)', alignItems: 'center' }}>
                    <StepIcon name={step.icon} />
                    <h3 className="h3">{step.title}</h3>
                  </div>
                  <p className="muted" style={{ marginTop: 'var(--s2)', lineHeight: 1.6 }}>
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          <div className="install-browser-help" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s3)' }}>
            <h3 className="h3">Открыли из Telegram или другого приложения?</h3>
            <p className="muted" style={{ lineHeight: 1.6 }}>
              Через меню «…» откройте страницу в Safari на iPhone или Chrome на Android. Или скопируйте ссылку и вставьте
              её в браузер.
            </p>
            <button type="button" className="button button-secondary" onClick={() => void copyLink()}>
              <svg width="20" height="20" fill="currentColor" viewBox="0 0 256 256" aria-hidden="true">
                <path d="M216,32H88a8,8,0,0,0-8,8V80H40a8,8,0,0,0-8,8V216a8,8,0,0,0,8,8H168a8,8,0,0,0,8-8V176h40a8,8,0,0,0,8-8V40A8,8,0,0,0,216,32ZM160,208H48V96H160Zm48-48H176V88a8,8,0,0,0-8-8H96V48H208Z" />
              </svg>
              Скопировать ссылку на студию
            </button>
            {copyMsg && (
              <p className="muted small" role="status">
                {copyMsg}
              </p>
            )}
          </div>
        </>
      )}
    </main>
  )
}
