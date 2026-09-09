import { ROLE_V3 } from "@/lib/db/schema"

export type UserPermissionLike = {
  isLeader?: boolean
  isVerified?: boolean
  roles?: string | string[] | null
}

/**
 * Parses user roles safely from either JSON string or string array.
 */
export function getUserRoles(user: UserPermissionLike | null | undefined): string[] {
  if (!user || !user.roles) return []
  if (Array.isArray(user.roles)) return user.roles
  try {
    const parsed = JSON.parse(user.roles)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

/**
 * Checks whether user has a specific role or is a leader/admin (leaders have all roles).
 */
export function hasRole(user: UserPermissionLike | null | undefined, role: string): boolean {
  if (!user) return false
  if (user.isLeader) return true
  const roles = getUserRoles(user)
  return roles.includes(role)
}

/**
 * Checks whether user has access to V3 features.
 * Leaders always have access. Regular users need to be verified AND have the "V3" role.
 */
export function hasV3Access(user: UserPermissionLike | null | undefined): boolean {
  if (!user) return false
  if (user.isLeader) return true
  if (!isUserVerified(user)) return false
  return hasRole(user, ROLE_V3)
}

/**
 * Checks whether user is verified.
 * Leaders are always verified. Regular users require isVerified === true.
 */
export function isUserVerified(user: UserPermissionLike | null | undefined): boolean {
  if (!user) return false
  if (user.isLeader) return true
  return Boolean(user.isVerified)
}
