const API_BASE = import.meta.env.VITE_API_URL.replace(/\/+$/, '')

export type ApiErrorBody = { error?: unknown }

export function getApiBase(): string {
  return API_BASE
}

const TOKEN_KEY = 'bb_admin_token'

export function getToken(): string | null {
  return window.localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null) {
  if (!token) {
    window.localStorage.removeItem(TOKEN_KEY)
    return
  }
  window.localStorage.setItem(TOKEN_KEY, token)
}

export async function parseErrorMessage(response: Response): Promise<string> {
  const fallback = `Request failed (${response.status})`
  try {
    const data = (await response.json()) as ApiErrorBody
    if (typeof data.error === 'string') return data.error
    if (data.error && typeof data.error === 'object') return JSON.stringify(data.error)
    return fallback
  } catch {
    return fallback
  }
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)

  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  })
}

export async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await apiFetch(path, init)
  if (!response.ok) throw new Error(await parseErrorMessage(response))
  return (await response.json()) as T
}
