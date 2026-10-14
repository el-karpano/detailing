import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { deleteMedia, uploadImage } from '../lib/mediaApi'
import { currentOwner, getStudio, updateStudio } from '../data/store'
import { DEFAULT_STUDIO } from '../data/defaults'
import type { InfoCard, Service, Studio, WorkPhoto } from '../types'

export default function OwnerSettings() {
  const nav = useNavigate()
  const owner = currentOwner()
  const studio = getStudio()
  const [draft, setDraft] = useState<Studio>(structuredClone(studio))
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  if (!owner) {
    nav('/owner')
    return null
  }

  function patch(p: Partial<Studio>, remote = true) {
    setDraft((d) => ({ ...d, ...p }))
    if (remote) updateStudio(p)
    setSaved(false)
  }

  function save() {
    updateStudio(draft)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function uploadTo(
    file: File | undefined,
    apply: (url: string) => void,
    label: string,
  ) {
    if (!file) return
    setError('')
    setBusy(label)
    try {
      const media = await uploadImage(file)
      apply(media.url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить фото')
    } finally {
      setBusy('')
    }
  }

  return (
    <main className="mx-auto max-w-lg space-y-5 px-5 pt-8 pb-16">
      <h1 className="text-2xl font-bold">Настройки студии</h1>
      <p className="text-sm text-white/60">
        Фото и тексты можно менять здесь — они сразу появятся на сайте.
      </p>

      {error && (
        <p role="alert" className="rounded-2xl border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      <Section title="Главное фото на главной">
        <ImagePicker
          url={draft.heroImageUrl}
          busyLabel={busy === 'hero' ? 'Загружаем…' : ''}
          onPick={(f) => uploadTo(f, (url) => patch({ heroImageUrl: url }), 'hero')}
          onClear={() => {
            void deleteMedia(draft.heroImageUrl)
            patch({ heroImageUrl: DEFAULT_STUDIO.heroImageUrl })
          }}
        />
        <p className="text-xs text-white/45">Лучше всего смотрится фото машины 16:9.</p>
      </Section>

      <Section title="Логотип">
        <ImagePicker
          url={draft.logoUrl}
          compact
          busyLabel={busy === 'logo' ? 'Загружаем…' : ''}
          onPick={(f) => uploadTo(f, (url) => patch({ logoUrl: url }), 'logo')}
          onClear={() => {
            void deleteMedia(draft.logoUrl)
            patch({ logoUrl: DEFAULT_STUDIO.logoUrl })
          }}
        />
      </Section>

      <Section title="Основное">
        <Field label="Название" value={draft.name} onChange={(v) => patch({ name: v }, false)} />
        <Field label="Слоган" value={draft.tagline} onChange={(v) => patch({ tagline: v }, false)} />
        <Field
          label="Описание"
          value={draft.description}
          onChange={(v) => patch({ description: v }, false)}
          textarea
        />
        <Field label="Адрес" value={draft.address} onChange={(v) => patch({ address: v }, false)} />
        <Field label="Телефон" value={draft.phone} onChange={(v) => patch({ phone: v }, false)} />
        <Field label="Часы работы" value={draft.workHours} onChange={(v) => patch({ workHours: v }, false)} />
        <Field label="Выходные" value={draft.weekends} onChange={(v) => patch({ weekends: v }, false)} />
        <Field
          label="Правила отмены"
          value={draft.cancelPolicy}
          onChange={(v) => patch({ cancelPolicy: v }, false)}
          textarea
        />
        <Field
          label="Боксов"
          value={String(draft.bays)}
          onChange={(v) => patch({ bays: Math.max(1, Number(v) || 1) }, false)}
        />
        <Field
          label="Подготовка между машинами, мин"
          value={String(draft.prepMin)}
          onChange={(v) => patch({ prepMin: Math.max(0, Number(v) || 0) }, false)}
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
        <div className="grid grid-cols-2 gap-3">
          {draft.photos.map((p, i) => (
            <div key={p.id} className="relative overflow-hidden rounded-2xl border border-white/10">
              <img src={p.imageUrl} alt={p.title} className="h-28 w-full object-cover" />
              <button
                type="button"
                className="absolute right-2 top-2 rounded-full bg-black/70 px-2.5 py-1 text-xs text-white"
                aria-label="Удалить фото"
                onClick={() => {
                  void deleteMedia(p.imageUrl)
                  const photos = draft.photos.filter((x) => x.id !== p.id)
                  setDraft((d) => ({ ...d, photos }))
                  updateStudio({ photos })
                }}
              >
                ✕
              </button>
              <div className="p-2">
                <input
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs outline-none"
                  value={p.title}
                  placeholder="Заголовок"
                  onChange={(e) => updatePhoto(i, { title: e.target.value })}
                />
              </div>
            </div>
          ))}
        </div>

        <label
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/20 px-4 py-8 text-sm text-white/70 ${
            busy === 'photo' ? 'opacity-60' : ''
          }`}
        >
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (!file) return
              void uploadTo(
                file,
                (url) => {
                  const photos: WorkPhoto[] = [
                    ...draft.photos,
                    {
                      id: crypto.randomUUID(),
                      title: 'Новая работа',
                      caption: '',
                      imageUrl: url,
                    },
                  ]
                  setDraft((d) => ({ ...d, photos }))
                  updateStudio({ photos })
                },
                'photo',
              )
            }}
          />
          <span className="text-2xl">＋</span>
          <span>{busy === 'photo' ? 'Загружаем фото…' : 'Добавить фото'}</span>
          <span className="text-xs text-white/40">JPG или PNG, до 2 МБ</span>
        </label>
        <p className="text-xs text-white/45">
          Фото появятся в блоке «Работы» на главной. Нажмите ✕, чтобы убрать.
        </p>
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

function ImagePicker({
  url,
  onPick,
  onClear,
  compact,
  busyLabel,
}: {
  url: string
  onPick: (f: File) => void
  onClear: () => void
  compact?: boolean
  busyLabel?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div className="space-y-2">
      {url && (
        <img
          src={url}
          alt=""
          className={`w-full rounded-2xl object-cover ${compact ? 'h-20' : 'h-40'}`}
        />
      )}
      <div className="flex gap-2">
        <button
          type="button"
          className="accent flex-1 rounded-2xl px-4 py-3 text-sm font-semibold"
          disabled={!!busyLabel}
          onClick={() => inputRef.current?.click()}
        >
          {busyLabel || (url ? 'Заменить фото' : 'Загрузить фото')}
        </button>
        {url && (
          <button
            type="button"
            className="glass-btn rounded-2xl px-4 py-3 text-sm"
            onClick={onClear}
          >
            Сбросить
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) onPick(f)
        }}
      />
    </div>
  )
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
