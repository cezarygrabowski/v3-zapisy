export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string; code?: "NEED_PLAYSTYLE" }

export function ok(message?: string): ActionResult {
  return message ? { ok: true, message } : { ok: true }
}

export function fail(error: string, code?: "NEED_PLAYSTYLE"): ActionResult {
  return code ? { ok: false, error, code } : { ok: false, error }
}
