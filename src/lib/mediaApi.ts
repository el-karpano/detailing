/**
 * Загрузка фото в Worker (KV). Сжимаем на клиенте — проще и быстрее для студии.
 */
import { authHeaders } from './auth'

const MAX_EDGE = 1600
const JPEG_QUALITY = 0.82

export type UploadedMedia = {
  id: string
  url: string
  contentType: string
  size: number
}

async function shrinkImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) return file

  let { width, height } = bitmap
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height))
  if (scale < 1) {
    width = Math.round(width * scale)
    height = Math.round(height * scale)
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
  )
  return blob && blob.size > 0 ? blob : file
}

export async function uploadImage(file: File): Promise<UploadedMedia> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Выберите файл-картинку (JPG, PNG, WebP)')
  }
  const body = await shrinkImage(file)
  if (body.size > 2 * 1024 * 1024) {
    throw new Error('Фото больше 2 МБ даже после сжатия')
  }
  const res = await fetch('/api/media', {
    method: 'POST',
    headers: { 'Content-Type': body.type || 'image/jpeg', ...authHeaders() },
    body,
  })
  const data = (await res.json().catch(() => ({}))) as UploadedMedia & { error?: string }
  if (!res.ok || !data.url) {
    throw new Error(data.error || `Ошибка загрузки (HTTP ${res.status})`)
  }
  return data
}

export async function deleteMedia(urlOrId: string): Promise<void> {
  if (!urlOrId.includes('/api/media/')) return
  const id = urlOrId.split('/').pop() || ''
  if (!id) return
  await fetch(`/api/media/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  }).catch(() => {})
}
