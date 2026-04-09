export interface AudioChunk {
  data: Uint8Array
  offsetSec: number
  durationSec: number
  index: number
}

const CHUNK_SEC = 600 // 10 min per chunk

/**
 * Extract audio from a video file using MP4Box — streams raw AAC samples,
 * no decoding, packages them into ADTS .aac chunks. Never loads full file.
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

    let audioTrackId: number | null = null
    let sampleRate = 48000
    let channelCount = 2
    let timescale = 1
    let codecConfig: Uint8Array | null = null

    // All raw AAC samples collected
    const rawSamples: Array<{ data: Uint8Array; dts: number; duration: number }> = []
    let readyFired = false
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
      sampleRate = audioTrack.audio?.sample_rate ?? 48000
      channelCount = audioTrack.audio?.channel_count ?? 2
      timescale = audioTrack.timescale ?? sampleRate

      // Get codec extradata (ESDS / AudioSpecificConfig) for ADTS header
      const trak = (mp4 as any).moov?.traks?.find((t: any) => t.tkhd?.track_id === audioTrackId)
      const esds = trak?.mdia?.minf?.stbl?.stsd?.entries?.[0]?.esds
      if (esds?.esd?.ES_Descriptor?.decoderConfig?.decoderSpecificInfo?.data) {
        codecConfig = new Uint8Array(esds.esd.ES_Descriptor.decoderConfig.decoderSpecificInfo.data)
      }

      progress(62, `Audio détecté (${audioTrack.codec}, ${sampleRate}Hz)…`)
      mp4.setExtractionOptions(audioTrackId!, null, { nbSamples: 200 })
      mp4.start()
    }

    mp4.onSamples = (_id: number, _user: any, samples: any[]) => {
      for (const s of samples) {
        rawSamples.push({
          data: new Uint8Array(s.data),
          dts: s.dts,
          duration: s.duration,
        })
      }
      progress(
        5 + Math.round((rawSamples.length / Math.max(1, rawSamples.length + 100)) * 55),
        `Extraction audio… (${rawSamples.length} frames)`
      )
    }

    mp4.onFlush = () => {
      if (!readyFired) {
        fail("Fichier MP4 illisible : moov introuvable. Remuxe avec: ffmpeg -i input.mp4 -c copy -movflags +faststart output.mp4")
        return
      }
      if (rawSamples.length === 0) {
        fail("Aucun sample audio extrait du fichier.")
        return
      }
      finalize()
    }

    mp4.onError = (e: any) => fail(`MP4Box error: ${e}`)

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
      progress(pct, readyFired ? `Extraction audio… (${rawSamples.length} frames)` : "Lecture fichier… (recherche du moov)")
      setTimeout(feedNext, 0)
    }

    feedNext()

    const finalize = () => {
      if (finalized) return
      finalized = true

      progress(65, "Découpage en chunks…")

      // Split samples into time-based chunks
      const totalDurationSec = rawSamples.reduce((acc, s) => acc + s.duration / timescale, 0)
      const numChunks = Math.max(1, Math.ceil(totalDurationSec / chunkSec))
      const chunks: AudioChunk[] = []

      // Group samples by chunk
      let chunkIdx = 0
      let chunkStart = 0
      let chunkSamples: typeof rawSamples = []

      const flush = (idx: number, startSec: number) => {
        if (chunkSamples.length === 0) return
        const dur = chunkSamples.reduce((a, s) => a + s.duration / timescale, 0)
        chunks.push({
          data: buildAdts(chunkSamples, sampleRate, channelCount, codecConfig),
          offsetSec: startSec,
          durationSec: dur,
          index: idx,
        })
        progress(65 + Math.round(((idx + 1) / numChunks) * 30), `Chunk ${idx + 1}/${numChunks}…`)
      }

      let elapsed = 0
      for (const s of rawSamples) {
        chunkSamples.push(s)
        elapsed += s.duration / timescale
        if (elapsed >= chunkSec * (chunkIdx + 1)) {
          flush(chunkIdx, chunkStart)
          chunkStart = elapsed
          chunkIdx++
          chunkSamples = []
        }
      }
      flush(chunkIdx, chunkStart)

      progress(100, "Prêt")
      resolve(chunks)
    }
  })
}

/**
 * Pack raw AAC frames into an ADTS bitstream (.aac file).
 * Each frame gets a 7-byte ADTS header prepended.
 */
function buildAdts(
  samples: Array<{ data: Uint8Array }>,
  sampleRate: number,
  channels: number,
  _codecConfig: Uint8Array | null
): Uint8Array {
  const ADTS_RATES = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350]
  const rateIdx = ADTS_RATES.indexOf(sampleRate)
  const freqIdx = rateIdx >= 0 ? rateIdx : 4 // default 44100
  const chanConf = Math.min(channels, 7)
  const profile = 1 // AAC-LC

  // Total size
  let total = 0
  for (const s of samples) total += 7 + s.data.length
  const out = new Uint8Array(total)
  let pos = 0

  for (const s of samples) {
    const frameLen = 7 + s.data.length
    // ADTS header (7 bytes, no CRC)
    out[pos]     = 0xFF
    out[pos + 1] = 0xF1 // ID=0 (MPEG-4), layer=0, no CRC
    out[pos + 2] = ((profile & 0x3) << 6) | ((freqIdx & 0xF) << 2) | ((chanConf >> 2) & 0x1)
    out[pos + 3] = ((chanConf & 0x3) << 6) | ((frameLen >> 11) & 0x3)
    out[pos + 4] = (frameLen >> 3) & 0xFF
    out[pos + 5] = ((frameLen & 0x7) << 5) | 0x1F
    out[pos + 6] = 0xFC
    pos += 7
    out.set(s.data, pos)
    pos += s.data.length
  }

  return out
}
