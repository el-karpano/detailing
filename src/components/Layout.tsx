import { NavLink, Outlet, useLocation, Link } from 'react-router-dom'
import { CLIENT_BRAND } from '../data/defaults'
import { getStudio } from '../data/store'
import { useStoreTick } from '../lib/useStoreTick'

const links = [
  { to: '/', label: 'Главная', icon: 'M4 10.5 12 4l8 6.5V20h-5v-6H10v6H4v-9.5Z' },
  { to: '/services', label: 'Услуги', icon: 'M5 5h6v6H5V5Zm8 0h6v6h-6V5ZM5 13h6v6H5v-6Zm8 0h6v6h-6v-6Z' },
  { to: '/my', label: 'Моя запись', icon: 'M7 3v3m10-3v3M4 9h16M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z' },
]

export default function Layout() {
  useStoreTick()
  const studio = getStudio()
  const loc = useLocation()
  const path = loc.pathname
  const isOwner = path.startsWith('/owner')
  const isAssistant = path.startsWith('/assistant')
  const hideNav = isOwner || isAssistant || path.startsWith('/install') || path.startsWith('/account')

  return (
    <div className="min-h-screen">
      <header className="topbar">
        <Link to="/" className="wordmark">
          <img
            className="brand-logo"
            src={studio.logoHeaderUrl || studio.logoUrl}
            alt={`Логотип ${CLIENT_BRAND.shortName}`}
          />
          <span>{CLIENT_BRAND.shortName}</span>
        </Link>
        <Link to="/account" className="button button-ghost icon-button" aria-label="Мой профиль">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="8" r="3.5" />
            <path d="M5 19c1.5-3.5 4-5 7-5s5.5 1.5 7 5" strokeLinecap="round" />
          </svg>
        </Link>
      </header>

      <Outlet />

      {!isOwner && (
        <footer className="footer">
          <span className="muted">{CLIENT_BRAND.shortName}</span>
          <a href={`tel:${studio.phone.replace(/[^\d+]/g, '')}`} className="text-link">
            Связаться <span aria-hidden>↗</span>
          </a>
        </footer>
      )}

      {!hideNav && (
        <nav className="bottom-nav" aria-label="Основная навигация">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === '/'}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d={l.icon} />
              </svg>
              <span>{l.label}</span>
            </NavLink>
          ))}
        </nav>
      )}

      {!hideNav && !isAssistant && (
        <Link to="/assistant" className="chat-launcher" aria-label="Открыть помощника">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l1.2 3.5L17 7l-3.5 1.2L12 12l-1.2-3.8L7 7l3.8-1.5L12 2Zm6 9 .8 2.2L21 14l-2.2.8L18 17l-.8-2.2L15 14l2.2-.8L18 11ZM6 14l.9 2.6L9.5 18l-2.6.9L6 21.5l-.9-2.6L2.5 18l2.6-.9L6 14Z" />
          </svg>
        </Link>
      )}
    </div>
  )
}
