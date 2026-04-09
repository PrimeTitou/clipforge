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

  progress(2, "Chargement du démuxeur…")

  const mp4boxMod = await import("mp4box")
  const MP4Box = (mp4boxMod as any).default ?? mp4boxMod

  return new Promise((resolve, reject) => {
    const mp4 = MP4Box.createFile()
    const targetSampleRate = 16000

    let audioTrackId: number | null = null
    let audioDecoder: AudioDecoder | null = null
    let allSamples: Float32Array[] = []
    let totalSamples = 0
    let decodePending = 0
    let samplesReceived = 0
    let feedDone = false
    let readyFired = false
    let sourceSampleRate = 48000
    let finalized = false

    const fail = (msg: string) => {
      if (finalized) return
      finalized = true
      reject(new Error(msg))
    }

    mp4.onReady = (info: any) => {
      readyFired = true
      const audioTrack = info.tracks?.find((t: any) => t.type === "audio")
      if (!audioTrack) { fail("Aucun flux audio trouvé dans le fichier."); return }

      audioTrackId = audioTrack.id
      sourceSampleRate = audioTrack.audio?.sample_rate ?? 48000
      progress(62, `Audio détecté (${audioTrack.codec})…`)

      try {
        audioDecoder = new AudioDecoder({
          output: (audioData: AudioData) => {
            const buf = new Float32Array(audioData.numberOfFrames * (audioData.numberOfChannels || 1))
            try {
              audioData.copyTo(buf, { planeIndex: 0, format: "f32-planar" })
            } catch {
              try { audioData.copyTo(buf, { planeIndex: 0 }) } catch {}
            }
            const mono = audioData.numberOfFrames === buf.length ? buf : buf.subarray(0, audioData.numberOfFrames)
            allSamples.push(new Float32Array(mono))
            totalSamples += mono.length
            audioData.close()
            decodePending--
            if (feedDone && decodePending === 0) finalize()
          },
          error: (e: any) => fail(`AudioDecoder error: ${e?.message ?? e}`),
        })

        audioDecoder.configure({
          codec: audioTrack.codec,
          sampleRate: sourceSampleRate,
          numberOfChannels: audioTrack.audio?.channel_count ?? 2,
        })
      } catch (e: any) {
        fail(`Impossible de configurer le décodeur audio: ${e?.message ?? e}`)
        return
      }

      mp4.setExtractionOptions(audioTrackId!, null, { nbSamples: 100 })
      mp4.start()
    }

    mp4.onSamples = (_id: number, _user: any, samples: any[]) => {
      samplesReceived += samples.length
      for (const sample of samples) {
        decodePending++
        try {
          audioDecoder!.decode(new EncodedAudioChunk({
            type: sample.is_sync ? "key" : "delta",
            timestamp: (sample.cts * 1_000_000) / sample.timescale,
            duration: (sample.duration * 1_000_000) / sample.timescale,
            data: sample.data,
          }))
        } catch (e: any) {
          decodePending--
          fail(`Decode error: ${e?.message ?? e}`)
          return
        }
      }
      if (feedDone) {
        progress(68, `Décodage audio… (${samplesReceived} samples)`)
      }
    }

    mp4.onFlush = async () => {
      feedDone = true
      if (!readyFired) {
        fail("Fichier MP4 illisible : le moov atom est introuvable ou corrompu. Essaie de remuxer avec HandBrake ou: ffmpeg -i input.mp4 -c copy -movflags +faststart output.mp4")
        return
      }
      // Flush the AudioDecoder to drain any buffered frames
      if (audioDecoder && audioDecoder.state !== "closed") {
        try { await audioDecoder.flush() } catch {}
      }
      finalize()
    }

    mp4.onError = (e: any) => fail(`MP4Box error: ${e}`)

    // Feed file in 4MB slices
    const SLICE = 4 * 1024 * 1024
    let offset = 0

    const feedNext = async () => {
      if (finalized) return
      if (offset >= file.size) {
        try { mp4.flush() } catch {}
        return
      }
      const end = Math.min(offset + SLICE, file.size)
      try {
        const ab = await file.slice(offset, end).arrayBuffer()
        const buf = ab as any
        buf.fileStart = offset
        mp4.appendBuffer(buf)
      } catch (e: any) {
        fail(`Lecture fichier échouée: ${e?.message ?? e}`)
        return
      }
      offset = end
      const pct = 5 + Math.round((offset / file.size) * 55)
      progress(pct, readyFired ? `Extraction audio… (${samplesReceived} samples)` : "Lecture fichier… (recherche du moov)")
      setTimeout(feedNext, 0)
    }

    // Safety watchdog: if nothing decoded after feed is done, bail out
    const watchdog = setInterval(() => {
      if (finalized) { clearInterval(watchdog); return }
      if (feedDone && readyFired && samplesReceived === 0) {
        clearInterval(watchdog)
        fail("Aucun sample audio extrait. Le fichier est peut-être fragmenté ou utilise un codec non supporté.")
      }
    }, 5000)

    feedNext()

    const finalize = async () => {
      if (finalized) return
      finalized = true
      clearInterval(watchdog)

      try { if (audioDecoder && audioDecoder.state !== "closed") await audioDecoder.flush() } catch {}

      if (totalSamples === 0) {
        reject(new Error("Aucun échantillon audio décodé."))
        return
      }

      progress(65, "Assemblage audio…")

      const merged = new Float32Array(totalSamples)
      let pos = 0
      for (const s of allSamples) { merged.set(s, pos); pos += s.length }
      allSamples = []

      const resampledLength = Math.ceil(totalSamples * (targetSampleRate / sourceSampleRate))
      const resampled = new Float32Array(resampledLength)
      const ratio = totalSamples / resampledLength
      for (let i = 0; i < resampledLength; i++) {
        resampled[i] = merged[Math.min(Math.floor(i * ratio), totalSamples - 1)]
      }

      progress(75, "Découpage en chunks…")

      const samplesPerChunk = chunkSec * targetSampleRate
      const numChunks = Math.max(1, Math.ceil(resampled.length / samplesPerChunk))
      const chunks: AudioChunk[] = []

      for (let i = 0; i < numChunks; i++) {
        const start = i * samplesPerChunk
        const end = Math.min(start + samplesPerChunk, resampled.length)
        const slice = resampled.slice(start, end)
        chunks.push({
          data: encodeWav(slice, targetSampleRate),
          offsetSec: i * chunkSec,
          durationSec: (end - start) / targetSampleRate,
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
