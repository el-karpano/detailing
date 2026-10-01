import { useState } from 'react'
import { Link } from 'react-router-dom'

export default function Account() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)

  return (
    <main className="safe-bottom shell" style={{ paddingTop: 'var(--s6)' }}>
      <Link to="/" className="text-link">
        ← На главную
      </Link>
      <h1 className="h1" style={{ marginTop: 'var(--s4)' }}>
        Профиль клиента
      </h1>
      <p className="muted" style={{ marginTop: 'var(--s4)', maxWidth: 420 }}>
        Сохраняйте новые записи в одном месте и открывайте их с любого устройства.
      </p>

      <div className="card" style={{ marginTop: 'var(--s8)', padding: 'var(--s6)' }}>
        <label className="label" htmlFor="email">
          Почта
        </label>
        <p className="muted small" style={{ margin: '4px 0 var(--s3)' }}>
          Пароль не нужен. Отправим ссылку для входа.
        </p>
        <input
          id="email"
          className="field"
          type="email"
          placeholder="you@mail.ru"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button
          type="button"
          className="button button-primary"
          style={{ marginTop: 'var(--s4)' }}
          onClick={() => setSent(true)}
        >
          Получить ссылку
        </button>
        {sent && (
          <p className="muted small" style={{ marginTop: 'var(--s3)' }}>
            Если адрес действует — ссылка отправлена. Проверьте почту.
          </p>
        )}
      </div>

      <Link to="/owner" className="text-link" style={{ marginTop: 'var(--s6)' }}>
        Вы владелец студии? Открыть кабинет студии
      </Link>
    </main>
  )
}
