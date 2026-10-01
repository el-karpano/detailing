import { useNavigate } from 'react-router-dom'
import { getBookings, getStudio } from '../data/store'
import { OwnerBookingRow } from './OwnerDashboard'
import { currentOwner } from '../data/store'

export default function OwnerBookings() {
  const nav = useNavigate()
  const owner = currentOwner()
  const studio = getStudio()
  const bookings = getBookings(studio.id).sort((a, b) =>
    (b.date + b.time).localeCompare(a.date + a.time),
  )

  if (!owner) {
    nav('/owner')
    return null
  }

  return (
    <main className="mx-auto max-w-lg space-y-4 px-5 pt-8 pb-10">
      <h1 className="text-2xl font-bold">Записи и оплаты</h1>
      <p className="text-sm text-white/60">
        {bookings.length} записей. Данные только этой студии.
      </p>
      <div className="space-y-2">
        {bookings.map((b) => (
          <OwnerBookingRow key={b.id} booking={b} onChange={() => nav(0)} />
        ))}
      </div>
    </main>
  )
}
