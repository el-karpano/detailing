import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Services from './pages/Services'
import MyBookings from './pages/MyBookings'
import BookingPage from './pages/BookingPage'
import OwnerLogin from './pages/OwnerLogin'
import OwnerDashboard from './pages/OwnerDashboard'
import OwnerSettings from './pages/OwnerSettings'
import OwnerBookings from './pages/OwnerBookings'
import Assistant from './pages/Assistant'
import Account from './pages/Account'
import Install from './pages/Install'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="services" element={<Services />} />
        <Route path="my" element={<MyBookings />} />
        <Route path="book/:serviceId" element={<BookingPage />} />
        <Route path="assistant" element={<Assistant />} />
        <Route path="account" element={<Account />} />
        <Route path="install" element={<Install />} />
        <Route path="owner" element={<OwnerLogin />} />
        <Route path="owner/dashboard" element={<OwnerDashboard />} />
        <Route path="owner/bookings" element={<OwnerBookings />} />
        <Route path="owner/settings" element={<OwnerSettings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
