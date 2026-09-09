import { cache } from "react"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { findUserById } from "@/lib/db/users"
import { type User } from "@/lib/db/schema"

export const IMPERSONATION_COOKIE = "impersonate_user_id"

export type ImpersonationState = {
  isImpersonating: boolean
  realUser: User | null
  impersonatedUser: User | null
}

export const getImpersonationState = cache(async (): Promise<ImpersonationState> => {
  try {
    const session = await auth()
    const realUserId = session?.user?.id
    if (!realUserId) {
      return { isImpersonating: false, realUser: null, impersonatedUser: null }
    }
    const realUser = await findUserById(realUserId)
    if (!realUser || !realUser.isLeader) {
      return { isImpersonating: false, realUser, impersonatedUser: null }
    }

    const cookieStore = await cookies()
    const impersonatedId = cookieStore.get(IMPERSONATION_COOKIE)?.value
    if (!impersonatedId || impersonatedId === realUserId) {
      return { isImpersonating: false, realUser, impersonatedUser: null }
    }

    const impersonatedUser = await findUserById(impersonatedId)
    if (!impersonatedUser) {
      return { isImpersonating: false, realUser, impersonatedUser: null }
    }

    return {
      isImpersonating: true,
      realUser,
      impersonatedUser,
    }
  } catch {
    return { isImpersonating: false, realUser: null, impersonatedUser: null }
  }
})

export const getRealUser = cache(async (): Promise<User | null> => {
  const state = await getImpersonationState()
  return state.realUser
})

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const state = await getImpersonationState()
  if (state.isImpersonating && state.impersonatedUser) {
    return state.impersonatedUser
  }
  return state.realUser
})

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser()
  if (!user) redirect("/login")
  return user
}

export async function requireLeader(): Promise<User> {
  const user = await requireUser()
  if (!user.isLeader) redirect("/panel")
  return user
}

export async function requireRealLeader(): Promise<User> {
  const realUser = await getRealUser()
  if (!realUser?.isLeader) redirect("/login")
  return realUser
}
