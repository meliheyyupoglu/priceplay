import { API_BASE } from '../config'
import type { User } from '../types'

function jsonHeaders(): HeadersInit {
  return { 'Content-Type': 'application/json', Accept: 'application/json' }
}

export async function register(body: {
  firstName: string
  lastName: string
  nickname: string
  email: string
  phone: string
  password: string
}): Promise<User> {
  const r = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify(body),
  })
  const data = (await r.json().catch(() => ({}))) as Record<string, unknown>
  if (r.status !== 201) throw new Error(String(data.error ?? 'Kayıt başarısız'))
  return data as unknown as User
}

export async function login(identifier: string, password: string): Promise<User> {
  const r = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ identifier: identifier.trim(), password }),
  })
  const data = (await r.json().catch(() => ({}))) as Record<string, unknown>
  if (r.status !== 200) throw new Error(String(data.error ?? 'Giriş başarısız'))
  return data as unknown as User
}

export async function fetchMe(userId: string): Promise<User> {
  const r = await fetch(`${API_BASE}/auth/me`, {
    headers: { Accept: 'application/json', 'x-user-id': userId },
  })
  const data = (await r.json().catch(() => ({}))) as Record<string, unknown>
  if (r.status !== 200) throw new Error(String(data.error ?? 'Profil alınamadı'))
  return data as unknown as User
}

export async function updateProfile(
  userId: string,
  body: { firstName: string; lastName: string; nickname: string; phone: string },
): Promise<User> {
  const r = await fetch(`${API_BASE}/auth/profile`, {
    method: 'PUT',
    headers: { ...jsonHeaders(), 'x-user-id': userId },
    body: JSON.stringify(body),
  })
  const data = (await r.json().catch(() => ({}))) as Record<string, unknown>
  if (r.status !== 200) throw new Error(String(data.error ?? 'Güncellenemedi'))
  return data as unknown as User
}
