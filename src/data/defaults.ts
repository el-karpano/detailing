import type { Booking, DaySchedule, Service, Studio } from '../types'

export const DEFAULT_STUDIO: Studio = {
  id: 'studio-main',
  name: 'SGX Detailing',
  tagline: 'Детейлинг премиум-класса',
  description:
    'Полировка, керамика, химчистка и защита кузова. Работаем по записи, бережно к вашему автомобилю.',
  address: 'Москва, ул. Автомобильная, 12',
  phone: '+7 (495) 000-00-00',
  workHours: 'Пн–Сб 09:00–21:00',
  weekends: 'Вс — выходной',
  logoUrl: '',
  heroImageUrl:
    'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1600&q=80',
  bays: 2,
  prepMin: 30,
  cancelPolicy: 'Отмена не позднее чем за 12 часов до визита.',
  services: [
    {
      id: 'svc-polish',
      title: 'Полировка кузова',
      description: 'Удаление царапин и восстановление блеска лака.',
      price: 8500,
      durationMin: 240,
      active: true,
    },
    {
      id: 'svc-ceramic',
      title: 'Керамическое покрытие',
      description: 'Защита лака на 1–2 года, гидрофобный эффект.',
      price: 25000,
      durationMin: 480,
      active: true,
    },
    {
      id: 'svc-interior',
      title: 'Химчистка салона',
      description: 'Глубокая чистка сидений, ковров и пластика.',
      price: 6500,
      durationMin: 300,
      active: true,
    },
    {
      id: 'svc-wash',
      title: 'Бесконтактная мойка',
      description: 'Бережная мойка с предварительным смывом.',
      price: 800,
      durationMin: 45,
      active: true,
    },
    {
      id: 'svc-ppf',
      title: 'Антигравийная плёнка',
      description: 'Защита капота и бампера от сколов.',
      price: 12000,
      durationMin: 360,
      active: true,
    },
  ],
  photos: [
    {
      id: 'ph-1',
      title: 'Полировка BMW',
      caption: 'Чёрный лак после одноступенчатой полировки',
      imageUrl:
        'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=900&q=80',
    },
    {
      id: 'ph-2',
      title: 'Керамика Mercedes',
      caption: 'Керамика 9H, гидрофобный эффект',
      imageUrl:
        'https://images.unsplash.com/photo-1502877338535-766e1452684a?auto=format&fit=crop&w=900&q=80',
    },
    {
      id: 'ph-3',
      title: 'Химчистка салона',
      caption: 'Светлая кожа после глубокой чистки',
      imageUrl:
        'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=900&q=80',
    },
  ],
  infoCards: [
    {
      id: 'card-1',
      title: 'Опыт 8 лет',
      body: 'Более 2000 автомобилей. Гарантия на работы.',
    },
    {
      id: 'card-2',
      title: 'Только проверенная химия',
      body: 'Ruppes, Koch-Chemie, Ceramic Pro.',
    },
    {
      id: 'card-3',
      title: 'Запись онлайн',
      body: 'Выберите услугу и удобное время за 2 минуты.',
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
      close: '21:00',
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
      serviceId: services[3]?.id ?? svc.id,
      serviceName: services[3]?.title ?? svc.title,
      clientName: 'Алексей Смирнов',
      phone: '+7 (900) 222-33-44',
      car: 'Audi Q7, белый',
      date: dayAfter.toISOString().slice(0, 10),
      time: '13:00',
      bay: 2,
      status: 'pending',
      price: services[3]?.price ?? svc.price,
      paid: 0,
      createdAt: now.toISOString(),
      reminderEnabled: false,
    },
  ]
}
