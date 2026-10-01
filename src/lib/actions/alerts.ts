"use server"

import { revalidatePath } from "next/cache"
import { requireUser } from "@/lib/session"
import { fail } from "@/lib/actions/result"
import { savePersonalTimer, completePersonalTimer, removePersonalTimer } from "@/lib/personal-timers"
import type { AlertTimerInput } from "@/lib/alert-timer-types"

export async function saveAlertTimer(input: AlertTimerInput) {
  const user = await requireUser()
  if (!user.isVerified && !user.isLeader) return fail("Konto wymaga weryfikacji.")
  const result = await savePersonalTimer(user.id, input)
  if (result.ok) revalidatePath("/", "layout")
  return result
}

export async function completeAlertTimer(timerId: string) {
  const user = await requireUser()
  if (!user.isVerified && !user.isLeader) return fail("Konto wymaga weryfikacji.")
  const result = await completePersonalTimer(user.id, timerId)
  if (result.ok) revalidatePath("/", "layout")
  return result
}

export async function deleteAlertTimer(timerId: string) {
  const user = await requireUser()
  if (!user.isVerified && !user.isLeader) return fail("Konto wymaga weryfikacji.")
  const result = await removePersonalTimer(user.id, timerId)
  if (result.ok) revalidatePath("/", "layout")
  return result
}
