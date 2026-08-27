export type TimerSoundType = "nets" | "cocoons" | "baroness"

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (AudioContextClass) {
      audioCtx = new AudioContextClass()
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    void audioCtx.resume()
  }
  return audioCtx
}

export function playTimerSound(type: TimerSoundType, volume: number = 0.7) {
  if (typeof window === "undefined" || volume <= 0) return
  const ctx = getAudioContext()
  if (!ctx) return

  if (ctx.state === "suspended") {
    void ctx.resume()
  }

  const now = ctx.currentTime
  const masterGain = ctx.createGain()
  const v = Math.max(0, Math.min(1, volume))
  masterGain.gain.setValueAtTime(v, now)
  masterGain.connect(ctx.destination)

  if (type === "nets") {
    // Siatki: bright, rapid crystal sparkle chime (3 ascending notes)
    const notes = [
      { freq: 1046.5, time: 0, dur: 0.16 }, // C6
      { freq: 1318.51, time: 0.07, dur: 0.16 }, // E6
      { freq: 1567.98, time: 0.14, dur: 0.32 }, // G6
    ]

    for (const n of notes) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = "sine"
      osc.frequency.setValueAtTime(n.freq, now + n.time)

      gain.gain.setValueAtTime(0.0001, now + n.time)
      gain.gain.exponentialRampToValueAtTime(0.35, now + n.time + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + n.time + n.dur)

      osc.connect(gain)
      gain.connect(masterGain)
      osc.start(now + n.time)
      osc.stop(now + n.time + n.dur)
    }
  } else if (type === "cocoons") {
    // Kokony: mystical dungeon gong / deep resonant dual bell
    const strikes = [
      { freqs: [440, 659.25, 880], time: 0, dur: 0.9, attack: 0.02, peak: 0.25 },
      { freqs: [554.37, 830.61, 1108.73], time: 0.16, dur: 1.3, attack: 0.02, peak: 0.28 },
    ]

    for (const strike of strikes) {
      for (const freq of strike.freqs) {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = "sine"
        osc.frequency.setValueAtTime(freq, now + strike.time)

        gain.gain.setValueAtTime(0.0001, now + strike.time)
        gain.gain.exponentialRampToValueAtTime(strike.peak, now + strike.time + strike.attack)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + strike.time + strike.dur)

        osc.connect(gain)
        gain.connect(masterGain)
        osc.start(now + strike.time)
        osc.stop(now + strike.time + strike.dur)
      }
    }
  } else if (type === "baroness") {
    // Baronówka / Królówka: dramatic 4-note ascending boss warning fanfare
    const notes = [
      { freq: 440, time: 0, dur: 0.12, peak: 0.28 }, // A4
      { freq: 554.37, time: 0.11, dur: 0.12, peak: 0.3 }, // C#5
      { freq: 659.25, time: 0.22, dur: 0.14, peak: 0.34 }, // E5
      { freq: 880, time: 0.35, dur: 0.75, peak: 0.38 }, // A5
    ]

    // Lowpass filter for warm brass sound
    const filter = ctx.createBiquadFilter()
    filter.type = "lowpass"
    filter.frequency.setValueAtTime(2800, now)
    filter.connect(masterGain)

    for (const n of notes) {
      const oscTriangle = ctx.createOscillator()
      const oscSaw = ctx.createOscillator()
      const gain = ctx.createGain()

      oscTriangle.type = "triangle"
      oscTriangle.frequency.setValueAtTime(n.freq, now + n.time)

      oscSaw.type = "sawtooth"
      oscSaw.frequency.setValueAtTime(n.freq * 1.002, now + n.time)

      gain.gain.setValueAtTime(0.0001, now + n.time)
      gain.gain.exponentialRampToValueAtTime(n.peak, now + n.time + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + n.time + n.dur)

      oscTriangle.connect(gain)
      oscSaw.connect(gain)
      gain.connect(filter)

      oscTriangle.start(now + n.time)
      oscSaw.start(now + n.time)
      oscTriangle.stop(now + n.time + n.dur)
      oscSaw.stop(now + n.time + n.dur)
    }
  }
}
