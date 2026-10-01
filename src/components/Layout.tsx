import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'

const links = [
  { to: '/', label: 'Главная', icon: 'M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1v-10.5Z' },
  { to: '/services', label: 'Услуги', icon: 'M4 6h16M4 12h16M4 18h10' },
  { to: '/my', label: 'Моя запись', icon: 'M8 7V3m8 4V3M4 11h16M5 5h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z' },
]

export default function Layout() {
  const loc = useLocation()
  const isOwner = loc.pathname.startsWith('/owner')

  return (
    <div className="min-h-screen bg-black text-white">
      <Outlet />

      {!isOwner && (
        <nav
          className="glass fixed inset-x-0 bottom-0 z-50 mx-auto mb-3 flex max-w-lg items-center justify-around rounded-2xl px-2 py-2"
          style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}
          aria-label="Основная навигация"
        >
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === '/'}
              className={({ isActive }) =>
                `flex min-w-[68px] flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[11px] transition ${
                  isActive ? 'bg-white/12 text-white' : 'text-white/55 hover:text-white'
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
                    animate={{ scale: isActive ? 1.08 : 1 }}
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
