export interface AudioChunk {
  data: Uint8Array
  offsetSec: number
  durationSec: number
  index: number
}

/**
 * Extract audio from a video/audio file using the Web Audio API (no FFmpeg.wasm).
 * Decodes the file natively in the browser, converts to mono 16kHz, encodes to WAV,
 * and splits into chunks. Works with any format Chrome supports (mp4, mov, mkv, webm, etc.)
 */
export async function extractAndChunkAudio(
  file: File,
  opts: {
    chunkSec?: number
    onProgress?: (pct: number, label: string) => void
  } = {}
): Promise<AudioChunk[]> {
  const chunkSec = opts.chunkSec ?? 600
  const progress = opts.onProgress ?? (() => {})

  progress(5, "Décodage audio…")

  // Decode using Web Audio API — streams via slice to avoid full OOM
  const audioCtx = new AudioContext({ sampleRate: 16000 })

  // Read file in slices of 256MB max to avoid ArrayBuffer allocation errors
  const SLICE = 256 * 1024 * 1024
  let audioBuffer: AudioBuffer

  if (file.size <= SLICE) {
    const arrayBuf = await file.arrayBuffer()
    progress(20, "Décodage audio…")
    audioBuffer = await audioCtx.decodeAudioData(arrayBuf)
  } else {
    // For large files, try reading the whole thing via streaming
    // Chrome can handle decodeAudioData on large buffers if given as a single call
    // We slice-read to avoid the single alloc error, then concat
    const parts: ArrayBuffer[] = []
    let loaded = 0
    for (let offset = 0; offset < file.size; offset += SLICE) {
      const slice = file.slice(offset, Math.min(offset + SLICE, file.size))
      parts.push(await slice.arrayBuffer())
      loaded += Math.min(SLICE, file.size - offset)
      progress(5 + Math.round((loaded / file.size) * 15), "Lecture du fichier…")
    }
    // Concat all parts into one buffer
    const total = parts.reduce((s, p) => s + p.byteLength, 0)
    const merged = new Uint8Array(total)
    let pos = 0
    for (const p of parts) { merged.set(new Uint8Array(p), pos); pos += p.byteLength }
    progress(20, "Décodage audio…")
    audioBuffer = await audioCtx.decodeAudioData(merged.buffer)
  }

  progress(35, "Conversion mono 16kHz…")

  // Mix down to mono
  const sampleRate = audioBuffer.sampleRate // already 16000 since we set it on AudioContext
  const numChannels = audioBuffer.numberOfChannels
  const length = audioBuffer.length
  const mono = new Float32Array(length)

  for (let ch = 0; ch < numChannels; ch++) {
    const channelData = audioBuffer.getChannelData(ch)
    for (let i = 0; i < length; i++) {
      mono[i] += channelData[i] / numChannels
    }
  }

  await audioCtx.close()

  progress(50, "Découpage en chunks…")

  // Split into chunks and encode each as WAV
  const samplesPerChunk = chunkSec * sampleRate
  const numChunks = Math.ceil(length / samplesPerChunk)
  const chunks: AudioChunk[] = []

  for (let i = 0; i < numChunks; i++) {
    const start = i * samplesPerChunk
    const end = Math.min(start + samplesPerChunk, length)
    const chunkSamples = mono.slice(start, end)
    const wav = encodeWav(chunkSamples, sampleRate)

    chunks.push({
      data: wav,
      offsetSec: i * chunkSec,
      durationSec: (end - start) / sampleRate,
      index: i,
    })

    progress(50 + Math.round(((i + 1) / numChunks) * 45), `Chunk ${i + 1}/${numChunks}…`)
  }

  progress(100, "Prêt")
  return chunks
}

/** Encode a Float32Array of mono PCM samples as a WAV file (16-bit PCM) */
function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const numSamples = samples.length
  const bytesPerSample = 2 // 16-bit
  const blockAlign = bytesPerSample
  const byteRate = sampleRate * blockAlign
  const dataSize = numSamples * bytesPerSample
  const bufferSize = 44 + dataSize

  const buf = new ArrayBuffer(bufferSize)
  const view = new DataView(buf)

  // RIFF header
  writeStr(view, 0, "RIFF")
  view.setUint32(4, 36 + dataSize, true)
  writeStr(view, 8, "WAVE")
  writeStr(view, 12, "fmt ")
  view.setUint32(16, 16, true)       // PCM chunk size
  view.setUint16(20, 1, true)        // PCM format
  view.setUint16(22, 1, true)        // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true)       // bits per sample
  writeStr(view, 36, "data")
  view.setUint32(40, dataSize, true)

  // PCM samples — clamp float32 to int16
  let offset = 44
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 32768 : s * 32767, true)
    offset += 2
  }

  return new Uint8Array(buf)
}

function writeStr(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i))
  }
}
