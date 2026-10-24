"use client"

import { useEffect, useEffectEvent, useRef, useState } from "react"
import { toast } from "sonner"
import { deleteEventImage, uploadEventImage } from "@/lib/actions/event-images"
import type { EventImage } from "@/lib/calendar-types"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

const MAX_SIDE = 2560

/** Re-encodes a screenshot as WebP (JPEG where the browser can't encode WebP) so it fits the upload limit. */
export async function compress(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const encode = (type: string) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.9))
  const webp = await encode("image/webp")
  if (webp?.type === "image/webp") return webp
  const jpeg = await encode("image/jpeg")
  if (!jpeg) throw new Error("encode failed")
  return jpeg
}

export function EventImages({
  eventId,
  images,
  currentUserId,
  isLeader,
  onChange,
}: {
  eventId: string
  images: EventImage[]
  currentUserId: string
  isLeader: boolean
  onChange: () => void
}) {
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFiles(files: File[]) {
    if (!files.length) return
    let failed = 0
    for (const [i, file] of files.entries()) {
      setUploading({ done: i, total: files.length })
      const formData = new FormData()
      try {
        formData.set("file", await compress(file))
      } catch {
        formData.set("file", file) // not decodable here; the server validates the type
      }
      const result = await uploadEventImage(eventId, formData)
      if (!result.ok) {
        failed++
        toast.error(`${file.name}: ${result.error}`)
      }
    }
    setUploading(null)
    if (failed < files.length) toast.success(`Dodano screenshoty: ${files.length - failed}.`)
    onChange()
  }

  // ⌘V / Ctrl+V anywhere in the open event window uploads images from the clipboard; text paste is untouched.
  const onPaste = useEffectEvent((e: ClipboardEvent) => {
    const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"))
    if (!files.length || uploading) return
    e.preventDefault()
    void handleFiles(files)
  })
  useEffect(() => {
    const listener = (e: ClipboardEvent) => onPaste(e)
    document.addEventListener("paste", listener)
    return () => document.removeEventListener("paste", listener)
  }, [])

  async function handlePasteButton() {
    try {
      const files: File[] = []
      for (const item of await navigator.clipboard.read()) {
        const type = item.types.find((t) => t.startsWith("image/"))
        if (type) files.push(new File([await item.getType(type)], "schowek.png", { type }))
      }
      if (files.length) void handleFiles(files)
      else toast.error("W schowku nie ma obrazka.")
    } catch {
      toast.error("Nie udało się odczytać schowka — wciśnij ⌘V / Ctrl+V w tym oknie.")
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Usunąć ten screenshot?")) return
    const result = await deleteEventImage(id)
    if (result.ok) onChange()
    else toast.error(result.error)
  }

  return (
    <div className="flex flex-col gap-3 border-t pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-heading text-sm font-bold">📸 Screenshoty dropu ({images.length})</span>
        {uploading ? (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Spinner />
            Wysyłanie {uploading.done + 1}/{uploading.total}…
          </span>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="text-xs" onClick={() => void handlePasteButton()}>
              📋 Wklej ze schowka
            </Button>
            <Button size="sm" variant="outline" className="text-xs" onClick={() => inputRef.current?.click()}>
              Dodaj pliki
            </Button>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files ?? [])
            e.target.value = ""
            void handleFiles(files)
          }}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Zrób screenshot i wciśnij <kbd className="font-mono">⌘V</kbd> / <kbd className="font-mono">Ctrl+V</kbd> w tym
        oknie — wklei się od razu. Możesz też dodać kilka plików naraz.
      </p>

      {images.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
          Brak screenshotów.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {images.map((img) => (
            <div key={img.id} className="group relative overflow-hidden rounded-lg border bg-muted/30">
              <a href={`/api/event-images/${img.id}`} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element -- auth-protected API image, no optimizer needed */}
                <img
                  src={`/api/event-images/${img.id}`}
                  alt={`Screenshot dropu od ${img.uploadedByNick}`}
                  loading="lazy"
                  className="aspect-video w-full object-cover transition-opacity group-hover:opacity-90"
                />
              </a>
              <div className="flex items-center justify-between gap-1 px-2 py-1 text-[11px] text-muted-foreground">
                <span className="truncate">{img.uploadedByNick}</span>
                {isLeader || img.uploadedById === currentUserId ? (
                  <button
                    type="button"
                    className="cursor-pointer hover:text-destructive"
                    onClick={() => void handleDelete(img.id)}
                    aria-label="Usuń screenshot"
                  >
                    ✕
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
