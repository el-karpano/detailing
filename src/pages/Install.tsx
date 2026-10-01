import { Link } from 'react-router-dom'

export default function Install() {
  return (
    <main className="safe-bottom shell" style={{ paddingTop: 'var(--s6)' }}>
      <Link to="/" className="text-link">
        ← На главную
      </Link>

      <div style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'center', marginTop: 'var(--s5)' }}>
        <img src="/assets/logo.svg" alt="" className="brand-logo" />
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>SGX</div>
          <div className="muted small">Приложение студии</div>
        </div>
      </div>

      <h1 className="h1" style={{ marginTop: 'var(--s5)' }}>
        Добавьте студию на главный экран
      </h1>
      <p className="muted" style={{ marginTop: 'var(--s4)' }}>
        Своя иконка на устройстве. Быстрый доступ к услугам и вашей записи.
      </p>

      <h2 className="h2" style={{ marginTop: 'var(--s10)' }}>
        Несколько шагов в браузере — и готово
      </h2>
      <p className="muted small" style={{ marginTop: 'var(--s2)' }}>
        Как установить
      </p>

      <div className="card" style={{ marginTop: 'var(--s5)', padding: 'var(--s5)' }}>
        {[
          {
            n: 1,
            t: 'Откройте сайт в Chrome или Edge',
            d: 'Найдите значок установки справа в адресной строке. Он появляется, когда браузер готов установить приложение.',
          },
          {
            n: 2,
            t: 'Подтвердите установку',
            d: 'Нажмите «Установить» в окне браузера. Если значка нет, проверьте пункт установки в меню браузера.',
          },
          {
            n: 3,
            t: 'Открывайте как приложение',
            d: 'Студия появится среди ваших приложений и будет открываться в отдельном окне. В Safari на Mac используйте «Файл» → «Добавить в Dock».',
          },
        ].map((s) => (
          <div key={s.n} style={{ display: 'flex', gap: 'var(--s4)', padding: 'var(--s4) 0' }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 999,
                background: 'var(--overlay)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {s.n}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{s.t}</div>
              <div className="muted small" style={{ marginTop: 4 }}>
                {s.d}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 'var(--s5)', padding: 'var(--s5)' }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>Открыли из Telegram или другого приложения?</div>
        <p className="muted small" style={{ marginTop: 6 }}>
          Через меню «…» откройте страницу в Safari на iPhone или Chrome на Android. Или скопируйте ссылку и вставьте её в
          браузер.
        </p>
        <button
          type="button"
          className="button button-secondary"
          style={{ marginTop: 'var(--s4)', width: '100%' }}
          onClick={() => {
            void navigator.clipboard?.writeText(window.location.origin)
          }}
        >
          Скопировать ссылку на студию
        </button>
      </div>
    </main>
  )
}
