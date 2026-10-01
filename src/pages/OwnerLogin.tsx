import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../data/store'

export default function OwnerLogin() {
  const nav = useNavigate()
  const [email, setEmail] = useState('owner@studio.local')
  const [password, setPassword] = useState('owner123')
  const [error, setError] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (login(email, password)) {
      nav('/owner/dashboard')
    } else {
      setError('Неверная почта или пароль')
    }
  }

  return (
    <main className="mx-auto max-w-md px-5 pt-12">
      <h1 className="text-2xl font-bold">Кабинет владельца</h1>
      <p className="mt-1 text-sm text-white/60">Вход по почте и паролю</p>

      <form onSubmit={submit} className="glass mt-6 space-y-4 rounded-2xl p-5">
        <div>
          <label className="mb-1 block text-sm text-white/70" htmlFor="email">
            Почта
          </label>
          <input
            id="email"
            type="email"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 outline-none focus:border-[#4690FF]"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-white/70" htmlFor="password">
            Пароль
          </label>
          <input
            id="password"
            type="password"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 outline-none focus:border-[#4690FF]"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <p className="text-sm text-red-300">{error}</p>}
        <button type="submit" className="accent w-full rounded-2xl px-5 py-3 font-semibold">
          Войти
        </button>
        <p className="text-xs text-white/45">Демо: owner@studio.local / owner123</p>
      </form>
    </main>
  )
}
