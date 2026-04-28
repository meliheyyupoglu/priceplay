import type { User } from '../types'

const USERS_KEY = 'pp_local_users_v1'
const SESSION_KEY = 'pp_local_session_v1'

type LocalUser = User & { password: string; updatedAt?: string | null }

function readUsers(): LocalUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY)
    const data = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(data) ? (data as LocalUser[]) : []
  } catch {
    return []
  }
}

function writeUsers(users: LocalUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

function saveSession(userId: string) {
  localStorage.setItem(SESSION_KEY, userId)
}

function makeUserId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `u_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function toPublicUser(user: LocalUser): User {
  const { password: _password, ...rest } = user
  return rest
}

export async function register(body: {
  firstName: string
  lastName: string
  nickname: string
  email: string
  phone: string
  password: string
}): Promise<User> {
  const users = readUsers()
  const email = String(body.email || '').trim().toLowerCase()
  const nickname = String(body.nickname || '').trim().toLowerCase()
  const phone = String(body.phone || '').replace(/\D/g, '')
  if (users.some((u) => u.email.toLowerCase() === email)) throw new Error('Email already used')
  if (users.some((u) => (u.nickname || '').toLowerCase() === nickname)) throw new Error('Nickname already used')
  if (users.some((u) => (u.phone || '').replace(/\D/g, '') === phone)) throw new Error('Phone already used')
  const next: LocalUser = {
    id: makeUserId(),
    firstName: String(body.firstName || '').trim(),
    lastName: String(body.lastName || '').trim(),
    nickname,
    email,
    phone,
    createdAt: new Date().toISOString(),
    password: String(body.password || ''),
  }
  users.push(next)
  writeUsers(users)
  saveSession(next.id)
  return toPublicUser(next)
}

export async function login(identifier: string, password: string): Promise<User> {
  const idn = String(identifier || '').trim().toLowerCase()
  const user = readUsers().find((u) => u.email.toLowerCase() === idn || (u.nickname || '').toLowerCase() === idn)
  if (!user || user.password !== String(password || '')) throw new Error('Invalid credentials')
  saveSession(user.id)
  return toPublicUser(user)
}

export async function fetchMe(userId: string): Promise<User> {
  const user = readUsers().find((u) => u.id === userId)
  if (!user) throw new Error('User not found')
  return toPublicUser(user)
}

export async function updateProfile(
  userId: string,
  body: { firstName: string; lastName: string; nickname: string; phone: string },
): Promise<User> {
  const users = readUsers()
  const idx = users.findIndex((u) => u.id === userId)
  if (idx < 0) throw new Error('User not found')
  const nickname = String(body.nickname || '').trim().toLowerCase()
  const phone = String(body.phone || '').replace(/\D/g, '')
  if (users.some((u, i) => i !== idx && (u.nickname || '').toLowerCase() === nickname)) {
    throw new Error('Nickname already used')
  }
  if (users.some((u, i) => i !== idx && (u.phone || '').replace(/\D/g, '') === phone)) {
    throw new Error('Phone already used')
  }
  users[idx] = {
    ...users[idx],
    firstName: String(body.firstName || '').trim(),
    lastName: String(body.lastName || '').trim(),
    nickname,
    phone,
    updatedAt: new Date().toISOString(),
  }
  writeUsers(users)
  return toPublicUser(users[idx])
}
