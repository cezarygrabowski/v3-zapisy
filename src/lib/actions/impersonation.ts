"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { fail, ok, type ActionResult } from "@/lib/actions/result"
import { findUserById } from "@/lib/db/users"
import { IMPERSONATION_COOKIE, requireRealLeader } from "@/lib/session"

export async function startImpersonation(targetUserId: string): Promise<ActionResult> {
  const leader = await requireRealLeader()
  if (targetUserId === leader.id) {
    return fail("Nie możesz wcielić się we własne konto.")
  }

  const target = await findUserById(targetUserId)
  if (!target) {
    return fail("Nie znaleziono wybranego gracza.")
  }

  const cookieStore = await cookies()
  cookieStore.set(IMPERSONATION_COOKIE, targetUserId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24, // 24 hours
  })

  revalidatePath("/", "layout")
  return ok(`Wcielono się w gracza ${target.gameNick}.`)
}

export async function stopImpersonation(): Promise<ActionResult> {
  const cookieStore = await cookies()
  cookieStore.delete(IMPERSONATION_COOKIE)
  revalidatePath("/", "layout")
  return ok("Zakończono wcielanie się. Powrócono do konta admina.")
}
