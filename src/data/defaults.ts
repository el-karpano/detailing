import type { Booking, DaySchedule, Service, Studio } from '../types'

/** Поднять при изменении услуг/фото/текстов — перезальёт контент из кода в localStorage. */
export const DEFAULTS_REV = 2

export const DEFAULT_STUDIO: Studio = {
  id: 'studio-main',
  name: 'SGX Detailing',
  tagline: 'Детейлинг, который возвращает кузову глубину, а салону — чистоту',
  description:
    'Детейлинг, который возвращает кузову глубину, а салону — чистоту. Работаем по записи, бережно к вашему автомобилю.',
  address: 'Москва, Примерная улица, 12',
  phone: '+7 (999) 000-00-00',
  workHours: '09:00–17:00',
  weekends: 'по времени студии',
  logoUrl: '/assets/logo.svg',
  heroImageUrl: '/assets/hero-car-blue.jpg',
  bays: 3,
  prepMin: 30,
  cancelPolicy: 'Отмена не позднее чем за 12 часов до визита.',
  services: [
    {
      id: 'svc-wash',
      title: 'Комплексная мойка',
      description: 'Кузов, диски, стёкла и аккуратная уборка салона — за один заезд',
      price: 3500,
      durationMin: 120,
      active: true,
    },
    {
      id: 'svc-interior',
      title: 'Химчистка салона',
      description: 'Глубокая очистка ткани, кожи и поверхностей, чтобы вернуть салону свежесть',
      price: 12000,
      durationMin: 480,
      active: true,
    },
    {
      id: 'svc-polish',
      title: 'Полировка кузова',
      description: 'Убираем мелкие царапины и возвращаем кузову глубокий блеск',
      price: 18000,
      durationMin: 480,
      active: true,
    },
    {
      id: 'svc-ceramic',
      title: 'Керамическое покрытие',
      description: 'Защита кузова с гидрофобным эффектом — уход проще, блеск дольше',
      price: 25000,
      durationMin: 960,
      active: true,
    },
  ],
  photos: [
    {
      id: 'ph-1',
      title: 'Детали кузова',
      caption: 'Глубина и блеск после комплексного ухода',
      imageUrl: '/assets/car2.jpg',
    },
    {
      id: 'ph-2',
      title: 'Капот и оптика — пример',
      caption: 'Полировка и защита лака',
      imageUrl: '/assets/car3.jpg',
    },
    {
      id: 'ph-3',
      title: 'Общий вид — пример',
      caption: 'Керамическое покрытие',
      imageUrl: '/assets/car4.jpg',
    },
  ],
  infoCards: [
    {
      id: 'card-1',
      title: 'Запись с ИИ',
      body: 'Подберёт услугу для автомобиля и покажет актуальное время',
    },
    {
      id: 'card-2',
      title: '3 бокса в работе',
      body: 'Принимаем несколько машин без очередей и ожидания',
    },
    {
      id: 'card-3',
      title: 'Студия всегда под рукой',
      body: 'Записывайтесь за несколько касаний, без поиска ссылки и звонков',
    },
  ],
}

export function seedSchedule(days = 14): DaySchedule[] {
  const out: DaySchedule[] = []
  const now = new Date()
  for (let i = 0; i < days; i++) {
    const d = new Date(now)
    d.setDate(now.getDate() + i)
    const iso = d.toISOString().slice(0, 10)
    const dow = d.getDay()
    out.push({
      date: iso,
      open: '09:00',
      close: '17:00',
      closed: dow === 0,
    })
  }
  return out
}

export function seedBookings(studioId: string, services: Service[]): Booking[] {
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  const dayAfter = new Date(now)
  dayAfter.setDate(now.getDate() + 2)
  const svc = services[0]
  return [
    {
      id: 'bk-1',
      studioId,
      serviceId: svc.id,
      serviceName: svc.title,
      clientName: 'Иван Петров',
      phone: '+7 (900) 111-22-33',
      car: 'BMW X5, чёрный',
      date: tomorrow.toISOString().slice(0, 10),
      time: '10:00',
      bay: 1,
      status: 'accepted',
      price: svc.price,
      paid: 0,
      createdAt: now.toISOString(),
      reminderEnabled: true,
    },
    {
      id: 'bk-2',
      studioId,
      serviceId: services[1]?.id ?? svc.id,
      serviceName: services[1]?.title ?? svc.title,
      clientName: 'Алексей Смирнов',
      phone: '+7 (900) 222-33-44',
      car: 'Audi Q7, белый',
      date: dayAfter.toISOString().slice(0, 10),
      time: '13:00',
      bay: 2,
      status: 'pending',
      price: services[1]?.price ?? svc.price,
      paid: 0,
      createdAt: now.toISOString(),
      reminderEnabled: false,
    },
  ]
}
