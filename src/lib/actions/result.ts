export type ActionResult<T = void> =
  | ({ ok: true; message?: string } & (T extends void ? { data?: never } : { data: T }))
  | { ok: false; error: string; code?: "NEED_PLAYSTYLE" }

export function ok<T = void>(message?: string, data?: T): ActionResult<T> {
  if (data !== undefined) {
    return { ok: true, message, data } as ActionResult<T>
  }
  return (message ? { ok: true, message } : { ok: true }) as ActionResult<T>
}

export function fail<T = void>(error: string, code?: "NEED_PLAYSTYLE"): ActionResult<T> {
  return (code ? { ok: false, error, code } : { ok: false, error }) as ActionResult<T>
}
