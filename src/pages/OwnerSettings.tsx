import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { currentOwner, getStudio, updateStudio } from '../data/store'
import type { InfoCard, Service, Studio, WorkPhoto } from '../types'

export default function OwnerSettings() {
  const nav = useNavigate()
  const owner = currentOwner()
  const studio = getStudio()
  const [draft, setDraft] = useState<Studio>(structuredClone(studio))
  const [saved, setSaved] = useState(false)

  if (!owner) {
    nav('/owner')
    return null
  }

  function patch(p: Partial<Studio>) {
    setDraft((d) => ({ ...d, ...p }))
    setSaved(false)
  }

  function save() {
    updateStudio(draft)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <main className="mx-auto max-w-lg space-y-5 px-5 pt-8 pb-16">
      <h1 className="text-2xl font-bold">Настройки студии</h1>
      <p className="text-sm text-white/60">
        Новая студия настраивается здесь — без изменения исходного кода.
      </p>

      <Section title="Основное">
        <Field label="Название" value={draft.name} onChange={(v) => patch({ name: v })} />
        <Field label="Слоган" value={draft.tagline} onChange={(v) => patch({ tagline: v })} />
        <Field
          label="Описание"
          value={draft.description}
          onChange={(v) => patch({ description: v })}
          textarea
        />
        <Field label="Адрес" value={draft.address} onChange={(v) => patch({ address: v })} />
        <Field label="Телефон" value={draft.phone} onChange={(v) => patch({ phone: v })} />
        <Field label="Часы работы" value={draft.workHours} onChange={(v) => patch({ workHours: v })} />
        <Field label="Выходные" value={draft.weekends} onChange={(v) => patch({ weekends: v })} />
        <Field
          label="Правила отмены"
          value={draft.cancelPolicy}
          onChange={(v) => patch({ cancelPolicy: v })}
          textarea
        />
        <Field
          label="Главное фото (URL)"
          value={draft.heroImageUrl}
          onChange={(v) => patch({ heroImageUrl: v })}
        />
        <Field label="Логотип (URL)" value={draft.logoUrl} onChange={(v) => patch({ logoUrl: v })} />
        <Field
          label="Боксов"
          value={String(draft.bays)}
          onChange={(v) => patch({ bays: Math.max(1, Number(v) || 1) })}
        />
        <Field
          label="Подготовка между машинами, мин"
          value={String(draft.prepMin)}
          onChange={(v) => patch({ prepMin: Math.max(0, Number(v) || 0) })}
        />
      </Section>

      <Section title="Услуги, цены, длительность">
        <div className="space-y-3">
          {draft.services.map((s, i) => (
            <div key={s.id} className="rounded-2xl border border-white/10 p-3">
              <input
                className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm font-semibold outline-none focus:border-[#4690FF]"
                value={s.title}
                onChange={(e) => updateService(i, { title: e.target.value })}
              />
              <textarea
                className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs outline-none focus:border-[#4690FF]"
                value={s.description}
                rows={2}
                onChange={(e) => updateService(i, { description: e.target.value })}
              />
              <div className="mt-2 grid grid-cols-3 gap-2">
                <input
                  className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm outline-none"
                  type="number"
                  value={s.price}
                  onChange={(e) => updateService(i, { price: Number(e.target.value) || 0 })}
                  aria-label="Цена"
                />
                <input
                  className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm outline-none"
                  type="number"
                  value={s.durationMin}
                  onChange={(e) => updateService(i, { durationMin: Number(e.target.value) || 0 })}
                  aria-label="Минуты"
                />
                <label className="flex items-center justify-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={s.active}
                    onChange={(e) => updateService(i, { active: e.target.checked })}
                  />
                  активна
                </label>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Три карточки на главной">
        <div className="space-y-3">
          {draft.infoCards.map((c, i) => (
            <div key={c.id} className="rounded-2xl border border-white/10 p-3">
              <input
                className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm font-semibold outline-none"
                value={c.title}
                onChange={(e) => updateCard(i, { title: e.target.value })}
              />
              <textarea
                className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs outline-none"
                rows={2}
                value={c.body}
                onChange={(e) => updateCard(i, { body: e.target.value })}
              />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Фотографии работ">
        <div className="space-y-3">
          {draft.photos.map((p, i) => (
            <div key={p.id} className="rounded-2xl border border-white/10 p-3">
              <img src={p.imageUrl} alt={p.title} className="h-28 w-full rounded-xl object-cover" />
              <input
                className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm outline-none"
                value={p.title}
                onChange={(e) => updatePhoto(i, { title: e.target.value })}
                placeholder="Заголовок"
              />
              <input
                className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs outline-none"
                value={p.caption}
                onChange={(e) => updatePhoto(i, { caption: e.target.value })}
                placeholder="Подпись под фото"
              />
              <input
                className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs outline-none"
                value={p.imageUrl}
                onChange={(e) => updatePhoto(i, { imageUrl: e.target.value })}
                placeholder="URL фото"
              />
            </div>
          ))}
          <button
            type="button"
            className="glass-btn w-full rounded-2xl px-4 py-3 text-sm"
            onClick={() =>
              setDraft((d) => ({
                ...d,
                photos: [
                  ...d.photos,
                  {
                    id: crypto.randomUUID(),
                    title: 'Новая работа',
                    caption: 'Подпись',
                    imageUrl:
                      'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=900&q=80',
                  },
                ],
              }))
            }
          >
            + Добавить карточку работы
          </button>
          <p className="text-xs text-white/45">
            Замена одного фото не сдвигает остальные: правьте URL нужной карточки.
          </p>
        </div>
      </Section>

      <div className="sticky bottom-20">
        <button onClick={save} className="accent w-full rounded-2xl px-5 py-4 text-base font-semibold">
          {saved ? 'Сохранено ✓' : 'Сохранить настройки'}
        </button>
      </div>
    </main>
  )

  function updateService(i: number, patch: Partial<Service>) {
    setDraft((d) => {
      const services = [...d.services]
      services[i] = { ...services[i], ...patch }
      return { ...d, services }
    })
    setSaved(false)
  }

  function updateCard(i: number, patch: Partial<InfoCard>) {
    setDraft((d) => {
      const infoCards = [...d.infoCards]
      infoCards[i] = { ...infoCards[i], ...patch }
      return { ...d, infoCards }
    })
    setSaved(false)
  }

  function updatePhoto(i: number, patch: Partial<WorkPhoto>) {
    setDraft((d) => {
      const photos = [...d.photos]
      photos[i] = { ...photos[i], ...patch }
      return { ...d, photos }
    })
    setSaved(false)
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="glass rounded-2xl p-4">
      <h2 className="mb-3 font-semibold">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

function Field({
  label,
  value,
  onChange,
  textarea,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  textarea?: boolean
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-white/55">{label}</label>
      {textarea ? (
        <textarea
          rows={3}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-[#4690FF]"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-[#4690FF]"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  )
}
