import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'

export type Platform = 'ios' | 'android' | 'desktop'

export function detectPlatform(): Platform {
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    return 'ios'
  }
  if (/Android/.test(ua)) return 'android'
  return 'desktop'
}

export function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

type InstallState = {
  installed: boolean
  available: boolean
  busy: boolean
  message: string
  install: () => Promise<void>
}

const InstallContext = createContext<InstallState>({
  installed: false,
  available: false,
  busy: false,
  message: '',
  install: async () => {},
})

export function useInstall() {
  return useContext(InstallContext)
}

type BIPEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallProvider({ children }: { children: React.ReactNode }) {
  const deferred = useRef<BIPEvent | null>(null)
  const busyRef = useRef(false)
  const [available, setAvailable] = useState(false)
  const [installed, setInstalled] = useState(isStandalone)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const mq = window.matchMedia('(display-mode: standalone)')
    const sync = () => setInstalled(mq.matches || isStandalone())
    sync()

    const onPrompt = (e: Event) => {
      e.preventDefault()
      deferred.current = e as BIPEvent
      setAvailable(true)
    }
    const onInstalled = () => {
      setInstalled(true)
      deferred.current = null
      setAvailable(false)
      setMessage('Приложение установлено. Откройте его с главного экрана.')
    }

    addEventListener('beforeinstallprompt', onPrompt)
    addEventListener('appinstalled', onInstalled)
    mq.addEventListener('change', sync)
    return () => {
      removeEventListener('beforeinstallprompt', onPrompt)
      removeEventListener('appinstalled', onInstalled)
      mq.removeEventListener('change', sync)
    }
  }, [])

  const install = useMemo(
    () => async () => {
      if (!deferred.current || busyRef.current) return
      busyRef.current = true
      setBusy(true)
      setMessage('')
      const evt = deferred.current
      deferred.current = null
      setAvailable(false)
      try {
        await evt.prompt()
        const choice = await evt.userChoice
        setMessage(
          choice.outcome === 'accepted'
            ? 'Запрос принят. Дождитесь завершения установки браузером.'
            : 'Установка отменена. Можно воспользоваться инструкцией ниже.',
        )
      } catch {
        setMessage('Не удалось открыть установку. Используйте меню браузера по инструкции ниже.')
      } finally {
        busyRef.current = false
        setBusy(false)
      }
    },
    [],
  )

  return (
    <InstallContext.Provider value={{ installed, available, busy, message, install }}>
      {children}
    </InstallContext.Provider>
  )
}

export type InstallStep = { icon: 'share' | 'plus' | 'check' | 'download' | 'menu' | 'device'; title: string; body: string }

export const INSTALL_GUIDES: Record<Platform, InstallStep[]> = {
  ios: [
    {
      icon: 'share',
      title: 'Откройте «Поделиться»',
      body: 'Откройте сайт в Safari. Нажмите квадрат со стрелкой вверх. В некоторых версиях Safari он находится в меню «…».',
    },
    {
      icon: 'plus',
      title: 'Выберите «На экран Домой»',
      body: 'Прокрутите список действий вниз. Если пункта нет, найдите его через «Изменить действия».',
    },
    {
      icon: 'check',
      title: 'Нажмите «Добавить»',
      body: 'Если есть переключатель «Открывать как веб-приложение», оставьте его включённым. Иконка студии появится на главном экране.',
    },
  ],
  android: [
    {
      icon: 'menu',
      title: 'Откройте сайт в Chrome',
      body: 'Нажмите меню «⋮» рядом с адресной строкой.',
    },
    {
      icon: 'download',
      title: 'Выберите установку',
      body: 'Нажмите «Установить приложение» или «Добавить на главный экран». Название зависит от версии браузера.',
    },
    {
      icon: 'check',
      title: 'Подтвердите добавление',
      body: 'Следуйте подсказкам Chrome. После установки откройте студию по новой иконке на устройстве.',
    },
  ],
  desktop: [
    {
      icon: 'download',
      title: 'Откройте сайт в Chrome или Edge',
      body: 'Найдите значок установки справа в адресной строке. Он появляется, когда браузер готов установить приложение.',
    },
    {
      icon: 'plus',
      title: 'Подтвердите установку',
      body: 'Нажмите «Установить» в окне браузера. Если значка нет, проверьте пункт установки в меню браузера.',
    },
    {
      icon: 'check',
      title: 'Открывайте как приложение',
      body: 'Студия появится среди ваших приложений и будет открываться в отдельном окне. В Safari на Mac используйте «Файл» → «Добавить в Dock».',
    },
  ],
}
