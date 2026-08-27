import { cache } from "react"
import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { findUserById } from "@/lib/db/users"
import { type User } from "@/lib/db/schema"

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) return null
  return findUserById(userId)
})

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser()
  if (!user) redirect("/login")
  return user
}

export async function requireLeader(): Promise<User> {
  const user = await requireUser()
  if (!user.isLeader) redirect("/")
  return user
}
