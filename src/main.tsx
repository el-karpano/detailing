import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './index.css'
import { fireDueReminders } from './lib/reminders'
import { getMyBookings, getStudio, syncBookingsFromServer, syncStudioFromServer } from './data/store'

registerSW({
  immediate: true,
  onRegisteredSW(_swUrl: string, registration: ServiceWorkerRegistration | undefined) {
    // Периодически проверяем обновления (важно для PWA на iOS/Android).
    if (registration) {
      setInterval(() => {
        void registration.update()
      }, 60 * 60 * 1000)
    }
  },
})

// Профиль студии (фото/цены из админки) + записи с сервера + напоминания
void syncStudioFromServer()
void syncBookingsFromServer().then(() => {
  try {
    const studio = getStudio()
    fireDueReminders(
      getMyBookings()
        .filter((b) => b.reminderEnabled && b.status !== 'cancelled')
        .map((b) => ({
          id: b.id,
          serviceName: b.serviceName,
          date: b.date,
          time: b.time,
          clientName: b.clientName,
          studioName: studio.name,
        })),
    )
  } catch {
    /* ignore */
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
