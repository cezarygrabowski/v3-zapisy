// Web Audio API Sound Generator & Map Sound Settings
// Generates distinct tones instantly in the browser without external mp3 downloads

export type SoundType =
  | "chime"
  | "sonar"
  | "war_horn"
  | "radar"
  | "bell"
  | "crystal"
  | "electronic"
  | "laser"

export const SOUND_OPTIONS: { id: SoundType; label: string; desc: string }[] = [
  { id: "chime", label: "Dzwonek (Chime)", desc: "Trzy łagodne, melodyjne tony" },
  { id: "sonar", label: "Sonar Łodzi", desc: "Niski, głęboki impuls akustyczny" },
  { id: "war_horn", label: "Róg Wojenny", desc: "Mocny, fanfarowy sygnał bojowy" },
  { id: "radar", label: "Piknięcie Radaru", desc: "Szybkie, podwójne wysokie piknięcie" },
  { id: "bell", label: "Dzwon Świątynny", desc: "Czysty, rezonujący gong" },
  { id: "crystal", label: "Kryształ", desc: "Jasne, szklane arpeggio" },
  { id: "electronic", label: "Alarm Cyfrowy", desc: "Klasyczny elektroniczny sygnał ostrzegawczy" },
  { id: "laser", label: "Impuls Laserowy", desc: "Futurystyczny, opadający świst" },
]

export const DEFAULT_MAP_SOUNDS: Record<string, SoundType> = {
  v3: "war_horn",
  "Red Las": "chime",
  "Góra Sohan": "crystal",
  "Dolina Seungryong": "radar",
  "Pustynia Yongbi": "sonar",
  "Świątynia Hwang": "bell",
  "Ognista Ziemia": "electronic",
  default: "chime",
}

const STORAGE_KEY = "v3_panel_map_sounds"
const AUDIO_ENABLED_KEY = "v3_panel_audio_enabled"
const VOLUME_KEY = "v3_panel_audio_volume"

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null
  if (!audioCtx) {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (AudioCtx) {
      audioCtx = new AudioCtx()
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {})
  }
  return audioCtx
}

export function getStoredMapSounds(): Record<string, SoundType> {
  if (typeof window === "undefined") return DEFAULT_MAP_SOUNDS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return { ...DEFAULT_MAP_SOUNDS, ...parsed }
    }
  } catch {
    // ignore
  }
  return DEFAULT_MAP_SOUNDS
}

export function saveStoredMapSound(mapKey: string, sound: SoundType) {
  if (typeof window === "undefined") return
  try {
    const current = getStoredMapSounds()
    const updated = { ...current, [mapKey]: sound }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch {
    // ignore
  }
}

export function isAudioAlertsEnabled(): boolean {
  if (typeof window === "undefined") return true
  try {
    const val = localStorage.getItem(AUDIO_ENABLED_KEY)
    if (val === null) return true
    return val === "true"
  } catch {
    return true
  }
}

export function setAudioAlertsEnabled(enabled: boolean) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(AUDIO_ENABLED_KEY, String(enabled))
  } catch {
    // ignore
  }
}

export function getAudioVolume(): number {
  if (typeof window === "undefined") return 0.7
  try {
    const val = localStorage.getItem(VOLUME_KEY)
    if (val !== null) {
      const parsed = Number.parseFloat(val)
      if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 1) return parsed
    }
  } catch {
    // ignore
  }
  return 0.7
}

export function setAudioVolume(volume: number) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(VOLUME_KEY, String(volume))
  } catch {
    // ignore
  }
}

export function playSound(soundType: SoundType, customVolume?: number) {
  const ctx = getAudioContext()
  if (!ctx) return

  const masterVol = customVolume ?? getAudioVolume()
  if (masterVol <= 0) return

  const now = ctx.currentTime

  switch (soundType) {
    case "chime": {
      // 3 ascending melodic chime notes
      const notes = [523.25, 659.25, 783.99] // C5, E5, G5
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = "sine"
        osc.frequency.setValueAtTime(freq, now + i * 0.12)

        gain.gain.setValueAtTime(0.001, now + i * 0.12)
        gain.gain.exponentialRampToValueAtTime(0.35 * masterVol, now + i * 0.12 + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.12 + 0.5)

        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now + i * 0.12)
        osc.stop(now + i * 0.12 + 0.55)
      })
      break
    }

    case "sonar": {
      // Deep resonant ping with long sub decay
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = "sine"
      osc.frequency.setValueAtTime(800, now)
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.8)

      gain.gain.setValueAtTime(0.001, now)
      gain.gain.exponentialRampToValueAtTime(0.45 * masterVol, now + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9)

      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.95)
      break
    }

    case "war_horn": {
      // Powerful brass fanfare (2 notes)
      const osc1 = ctx.createOscillator()
      const osc2 = ctx.createOscillator()
      const gain = ctx.createGain()

      osc1.type = "sawtooth"
      osc2.type = "triangle"

      osc1.frequency.setValueAtTime(220, now) // A3
      osc1.frequency.setValueAtTime(330, now + 0.18) // E4
      osc2.frequency.setValueAtTime(220 * 0.995, now)
      osc2.frequency.setValueAtTime(330 * 1.005, now + 0.18)

      gain.gain.setValueAtTime(0.001, now)
      gain.gain.exponentialRampToValueAtTime(0.3 * masterVol, now + 0.04)
      gain.gain.setValueAtTime(0.35 * masterVol, now + 0.18)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7)

      osc1.connect(gain)
      osc2.connect(gain)
      gain.connect(ctx.destination)

      osc1.start(now)
      osc2.start(now)
      osc1.stop(now + 0.75)
      osc2.stop(now + 0.75)
      break
    }

    case "radar": {
      // High-pitched double pip
      ;[0, 0.14].forEach((delay) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = "sine"
        osc.frequency.setValueAtTime(1400, now + delay)

        gain.gain.setValueAtTime(0.001, now + delay)
        gain.gain.exponentialRampToValueAtTime(0.4 * masterVol, now + delay + 0.01)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.09)

        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now + delay)
        osc.stop(now + delay + 0.1)
      })
      break
    }

    case "bell": {
      // Clear temple bell with rich harmonics
      const freqs = [587.33, 1174.66, 1762.0] // D5 + harmonics
      freqs.forEach((freq, index) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = "sine"
        osc.frequency.setValueAtTime(freq, now)

        const amp = (0.35 / (index + 1)) * masterVol
        gain.gain.setValueAtTime(0.001, now)
        gain.gain.exponentialRampToValueAtTime(amp, now + 0.01)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2)

        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now)
        osc.stop(now + 1.25)
      })
      break
    }

    case "crystal": {
      // Shimmering crystalline arpeggio
      const notes = [659.25, 880.0, 1174.66, 1567.98] // E5, A5, D6, G6
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = "sine"
        osc.frequency.setValueAtTime(freq, now + i * 0.07)

        gain.gain.setValueAtTime(0.001, now + i * 0.07)
        gain.gain.exponentialRampToValueAtTime(0.25 * masterVol, now + i * 0.07 + 0.015)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.07 + 0.45)

        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now + i * 0.07)
        osc.stop(now + i * 0.07 + 0.5)
      })
      break
    }

    case "electronic": {
      // Classic rapid 3-beep tech alarm
      ;[0, 0.1, 0.2].forEach((delay) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = "square"
        osc.frequency.setValueAtTime(987.77, now + delay) // B5

        gain.gain.setValueAtTime(0.001, now + delay)
        gain.gain.exponentialRampToValueAtTime(0.2 * masterVol, now + delay + 0.01)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.06)

        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now + delay)
        osc.stop(now + delay + 0.07)
      })
      break
    }

    case "laser": {
      // Sci-fi downwards laser zap
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = "sawtooth"
      osc.frequency.setValueAtTime(1600, now)
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.25)

      gain.gain.setValueAtTime(0.001, now)
      gain.gain.exponentialRampToValueAtTime(0.3 * masterVol, now + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3)

      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.35)
      break
    }
  }
}

export function playMapSound(mapName: string) {
  if (!isAudioAlertsEnabled()) return
  const sounds = getStoredMapSounds()
  const soundType = sounds[mapName] || sounds.default || "chime"
  playSound(soundType)
}
