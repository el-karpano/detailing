import { CLIENT_BRAND } from '../data/client-data'

const currency = (CLIENT_BRAND as { currency?: string }).currency ?? '₽'

/** 3500 → «3 500 ₽» / «3 500 Br» */
export function formatMoney(price: number): string {
  return `${price.toLocaleString('ru-RU')} ${currency}`
}

/** Услуга с ценой «от» → «от 300 Br» */
export function formatServicePrice(price: number, priceFrom?: boolean): string {
  return priceFrom ? `от ${formatMoney(price)}` : formatMoney(price)
}
