import { randomBytes, scrypt, timingSafeEqual } from "node:crypto"
import { promisify } from "node:util"

const scryptAsync = promisify(scrypt)

export const LOGIN_PATTERN = /^[a-z0-9._-]{3,24}$/

export function normalizeLogin(value: string): string {
  return value.trim().toLowerCase()
}

export function parseLogin(value: string): string | null {
  const login = normalizeLogin(value)
  if (!LOGIN_PATTERN.test(login)) return null
  return login
}

export function parsePassword(value: string): string | null {
  if (value.length < 8 || value.length > 72) return null
  return value
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex")
  const derived = (await scryptAsync(password, salt, 64)) as Buffer
  return `${salt}:${derived.toString("hex")}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":")
  if (!salt || !hash) return false
  const derived = (await scryptAsync(password, salt, 64)) as Buffer
  const expected = Buffer.from(hash, "hex")
  if (derived.length !== expected.length) return false
  return timingSafeEqual(derived, expected)
}
