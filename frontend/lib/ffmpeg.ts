export interface AudioChunk {
  data: Uint8Array
  offsetSec: number
  durationSec: number
  index: number
}

const CHUNK_SEC = 600 // 10 min per chunk

/**
 * Extract audio from a video file using WebCodecs + MP4Box streaming.
 * Reads the file in small slices — never loads the full file into RAM.
 */
export async function extractAndChunkAudio(
  file: File,
  opts: {
    chunkSec?: number
    onProgress?: (pct: number, label: string) => void
  } = {}
): Promise<AudioChunk[]> {
  const chunkSec = opts.chunkSec ?? CHUNK_SEC
  const progress = opts.onProgress ?? (() => {})

  progress(5, "Chargement du démuxeur…")

  // Dynamic import to avoid SSR issues
  const MP4Box = (await import("mp4box")).default

  return new Promise((resolve, reject) => {
    const mp4 = MP4Box.createFile()
    const sampleRate = 16000

    let audioTrackId: number | null = null
    let audioDecoder: AudioDecoder | null = null
    let allSamples: Float32Array[] = []
    let totalSamples = 0
    let decodePending = 0
    let extractionDone = false

    // When MP4Box finds tracks
    mp4.onReady = (info: any) => {
      const audioTrack = info.tracks?.find((t: any) => t.type === "audio")
      if (!audioTrack) { reject(new Error("Aucun flux audio trouvé dans le fichier.")); return }

      audioTrackId = audioTrack.id

      audioDecoder = new AudioDecoder({
        output: (audioData: AudioData) => {
          // Copy decoded audio to Float32Array
          const buf = new Float32Array(audioData.numberOfFrames)
          audioData.copyTo(buf, { planeIndex: 0, format: "f32-planar" })
          allSamples.push(buf)
          totalSamples += buf.length
          audioData.close()
          decodePending--
          if (extractionDone && decodePending === 0) finalize()
        },
        error: (e: any) => reject(new Error(`AudioDecoder error: ${e}`)),
      })

      audioDecoder.configure({
        codec: audioTrack.codec,
        sampleRate: audioTrack.audio?.sample_rate ?? 48000,
        numberOfChannels: audioTrack.audio?.channel_count ?? 2,
      })

      mp4.setExtractionOptions(audioTrackId!, null, { nbSamples: 100 })
      mp4.start()
    }

    mp4.onSamples = (_id: number, _user: any, samples: any[]) => {
      for (const sample of samples) {
        decodePending++
        audioDecoder!.decode(new EncodedAudioChunk({
          type: sample.is_sync ? "key" : "delta",
          timestamp: (sample.cts * 1_000_000) / sample.timescale,
          duration: (sample.duration * 1_000_000) / sample.timescale,
          data: sample.data,
        }))
      }
    }

    mp4.onFlush = async () => {
      extractionDone = true
      if (decodePending === 0) finalize()
    }

    mp4.onError = (e: any) => reject(new Error(`MP4Box error: ${e}`))

    // Feed file in 4MB slices
    const SLICE = 4 * 1024 * 1024
    let offset = 0

    const feedNext = async () => {
      if (offset >= file.size) {
        mp4.flush()
        return
      }
      const end = Math.min(offset + SLICE, file.size)
      const buf = await file.slice(offset, end).arrayBuffer() as any
      buf.fileStart = offset
      mp4.appendBuffer(buf)
      offset = end
      progress(5 + Math.round((offset / file.size) * 55), "Extraction audio…")
      setTimeout(feedNext, 0)
    }

    feedNext()

    const finalize = async () => {
      progress(65, "Assemblage audio…")

      // Merge all Float32 chunks into one big array
      const merged = new Float32Array(totalSamples)
      let pos = 0
      for (const s of allSamples) { merged.set(s, pos); pos += s.length }
      allSamples = []

      // Resample to 16kHz if needed (simple linear interpolation)
      const sourceSampleRate = (mp4 as any).moov?.traks?.[0]?.mdia?.mdhd?.timescale ?? 48000
      const resampledLength = Math.ceil(totalSamples * (sampleRate / sourceSampleRate))
      const resampled = new Float32Array(resampledLength)
      const ratio = totalSamples / resampledLength
      for (let i = 0; i < resampledLength; i++) {
        resampled[i] = merged[Math.min(Math.floor(i * ratio), totalSamples - 1)]
      }

      progress(75, "Découpage en chunks…")

      // Split into WAV chunks
      const samplesPerChunk = chunkSec * sampleRate
      const numChunks = Math.ceil(resampled.length / samplesPerChunk)
      const chunks: AudioChunk[] = []

      for (let i = 0; i < numChunks; i++) {
        const start = i * samplesPerChunk
        const end = Math.min(start + samplesPerChunk, resampled.length)
        const slice = resampled.slice(start, end)
        chunks.push({
          data: encodeWav(slice, sampleRate),
          offsetSec: i * chunkSec,
          durationSec: (end - start) / sampleRate,
          index: i,
        })
        progress(75 + Math.round(((i + 1) / numChunks) * 20), `Chunk ${i + 1}/${numChunks}…`)
      }

      progress(100, "Prêt")
      resolve(chunks)
    }
  })
}

function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const dataSize = samples.length * 2
  const buf = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buf)
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)) }
  w(0, "RIFF"); view.setUint32(4, 36 + dataSize, true); w(8, "WAVE")
  w(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true)
  view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true)
  view.setUint16(34, 16, true); w(36, "data"); view.setUint32(40, dataSize, true)
  let o = 44
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(o, s < 0 ? s * 32768 : s * 32767, true); o += 2
  }
  return new Uint8Array(buf)
}
