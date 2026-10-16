// Small helper for talking to the FastAPI backend.
// There is no login: each browser gets an anonymous id so its data stays separate.
const KEY = "ls-user-id"
let memoryId = ""

export function userId(): string {
  try {
    let id = localStorage.getItem(KEY)
    if (!id) {
      id = newId()
      localStorage.setItem(KEY, id)
    }
    return id
  } catch {
    return memoryId || (memoryId = newId())
  }
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID()
  return `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(path, {
    method: init.method || "GET",
    headers: { "Content-Type": "application/json", "X-User-Id": userId() },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
  let data: unknown = null
  try {
    data = await res.json()
  } catch {
    /* non-JSON response */
  }
  if (!res.ok) {
    const msg = (data as { error?: string } | null)?.error
    throw new Error(msg || `Request failed (${res.status})`)
  }
  return data as T
}

export type Stats = {
  questions_asked: number
  interviews_started: number
  interviews_finished: number
  answers_reviewed: number
  average_rating: number | null
  focus_areas: string[]
}

export type Health = { ok: boolean; aiConfigured: boolean; model: string | null }
