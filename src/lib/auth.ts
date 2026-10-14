/**
 * Токен сессии владельца (localStorage) для Authorization: Bearer.
 */

function slug() {
  try {
    return new URLSearchParams(window.location.search).get('studio')?.trim() || 'default'
  } catch {
    return 'default'
  }
}

function key() {
  return `detailing-mvp-auth:${slug()}`
}

export function getAuthToken(): string {
  try {
    return localStorage.getItem(key()) || ''
  } catch {
    return ''
  }
}

export function setAuthToken(token: string) {
  try {
    if (token) localStorage.setItem(key(), token)
    else localStorage.removeItem(key())
  } catch {
    /* ignore */
  }
}

export function authHeaders(): Record<string, string> {
  const token = getAuthToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}
