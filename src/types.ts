export type Service = {
  id: string
  title: string
  description: string
  price: number
  /** true — цена «от» (уточняется после осмотра) */
  priceFrom?: boolean
  durationMin: number
  active: boolean
}

export type WorkPhoto = {
  id: string
  title: string
  caption: string
  imageUrl: string
}

export type InfoCard = {
  id: string
  title: string
  body: string
}

export type BookingStatus = 'pending' | 'accepted' | 'ready' | 'done' | 'cancelled'

export type Booking = {
  id: string
  studioId: string
  serviceId: string
  serviceName: string
  clientName: string
  phone: string
  car: string
  date: string // yyyy-MM-dd
  time: string // HH:mm
  bay: number
  status: BookingStatus
  price: number
  paid: number
  createdAt: string
  reminderEnabled: boolean
  durationMin?: number
  /** секрет для отмены своей записи без входа в кабинет */
  clientToken?: string
}

export type OwnerUser = {
  email: string
  password: string
  studioId: string
}

export type Studio = {
  id: string
  name: string
  tagline: string
  description: string
  address: string
  phone: string
  workHours: string
  weekends: string
  logoUrl: string
  logoHeaderUrl?: string
  heroImageUrl: string
  bays: number
  prepMin: number
  services: Service[]
  photos: WorkPhoto[]
  infoCards: InfoCard[]
  cancelPolicy: string
}

export type DaySchedule = {
  date: string
  open: string
  close: string
  closed: boolean
}
