import { NavLink, Outlet, useLocation, Link } from 'react-router-dom'
import { motion } from 'framer-motion'

const links = [
  {
    to: '/',
    label: 'Главная',
    icon: 'M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z',
  },
  { to: '/services', label: 'Услуги', icon: 'M5 5h6v6H5V5Zm8 0h6v6h-6V5ZM5 13h6v6H5v-6Zm8 0h6v6h-6v-6Z' },
  {
    to: '/my',
    label: 'Моя запись',
    icon: 'M8 3v3m8-3v3M4 9h16M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z',
  },
]

function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-2xl bg-[#4690FF]"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none">
        <path
          d="M4 14c3-6 7-8 12-8-1 5-4 8-9 9 3 0 6 1 8 3-4 1-8-1-11-4Z"
          fill="white"
        />
      </svg>
    </span>
  )
}

export { LogoMark }

export default function Layout() {
  const loc = useLocation()
  const isOwner = loc.pathname.startsWith('/owner')

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="site-header sticky top-0 z-40 bg-black/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg items-center justify-between px-5 py-3">
          <Link to="/" className="flex items-center gap-2.5">
            <LogoMark size={36} />
            <span className="text-[15px] font-semibold tracking-tight">SGX</span>
          </Link>
          <Link
            to="/owner"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white/70 hover:text-white"
            aria-label="Профиль"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="8" r="3.5" />
              <path d="M5 19c1.5-3.5 4-5 7-5s5.5 1.5 7 5" strokeLinecap="round" />
            </svg>
          </Link>
        </div>
      </header>

      <Outlet />

      <footer className="border-t border-[#262626] px-5 pb-28 pt-8">
        <div className="mx-auto flex max-w-lg items-center justify-between text-sm">
          <span className="text-white/70">SGX</span>
          <a href="tel:+79990000000" className="text-white/70 hover:text-white">
            Связаться <span className="arrow-up">↗</span>
          </a>
        </div>
      </footer>

      {!isOwner && (
        <nav
          className="nav-pill fixed inset-x-0 bottom-0 z-50 mx-auto mb-4 flex w-[calc(100%-32px)] max-w-md items-center justify-around px-2 py-2"
          style={{ paddingBottom: 'calc(0.55rem + env(safe-area-inset-bottom, 0px))' }}
          aria-label="Основная навигация"
        >
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === '/'}
              className={({ isActive }) =>
                `nav-item flex min-w-[92px] flex-col items-center gap-1 px-3 py-2.5 text-[12px] ${
                  isActive ? 'active' : 'text-white/55 hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <motion.svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={isActive ? 2.2 : 1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    animate={{ scale: isActive ? 1.06 : 1 }}
                  >
                    <path d={l.icon} />
                  </motion.svg>
                  <span>{l.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  )
}
