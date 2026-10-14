/**
 * Профиль студии на сервере (D1) — источник истины для фото/контента.
 */
import type { Studio } from '../types'
import { authHeaders } from './auth'

async function req(path: string, init?: RequestInit) {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(init?.headers || {}) },
  })
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    const msg = typeof data.error === 'string' ? data.error : `HTTP ${res.status}`
    throw new Error(msg)
  }
  return data
}

export async function fetchStudioProfile(studioId: string): Promise<Studio | null> {
  const data = await req(`/api/studio?studio=${encodeURIComponent(studioId)}`)
  return (data.studio as Studio | null) || null
}

export async function pushStudioProfile(studio: Studio): Promise<void> {
  await req('/api/studio', {
    method: 'PUT',
    body: JSON.stringify({ studio: { ...studio, id: studio.id } }),
  })
}
