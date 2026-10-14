import { useSyncExternalStore } from 'react'
import { getStoreVersion, subscribeStore } from '../data/store'

/** Перерисовка при любом изменении store (sync с сервера, add/update booking). */
export function useStoreTick() {
  return useSyncExternalStore(subscribeStore, getStoreVersion, () => 0)
}
