import { FFmpeg } from "@ffmpeg/ffmpeg"
import { fetchFile, toBlobURL } from "@ffmpeg/util"

let ffmpegInstance: FFmpeg | null = null
let loadingPromise: Promise<FFmpeg> | null = null

const CORE_BASE = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd"

export async function getFFmpeg(onLog?: (msg: string) => void): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance
  if (loadingPromise) return loadingPromise

  loadingPromise = (async () => {
    const ff = new FFmpeg()
    if (onLog) ff.on("log", ({ message }) => onLog(message))
    await ff.load({
      coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, "application/wasm"),
    })
    ffmpegInstance = ff
    return ff
  })()

  return loadingPromise
}

export interface AudioChunk {
  data: Uint8Array
  offsetSec: number
  durationSec: number
  index: number
}

/**
 * Extract audio from a video file and split it into ~10min mp3 chunks at 32kbps mono.
 * Returns an array of chunks with their time offsets.
 */
export async function extractAndChunkAudio(
  file: File,
  opts: {
    chunkSec?: number
    onProgress?: (pct: number, label: string) => void
  } = {}
): Promise<AudioChunk[]> {
  const chunkSec = opts.chunkSec ?? 600 // 10 min
  const progress = opts.onProgress ?? (() => {})

  progress(0, "Chargement de FFmpeg…")
  const ff = await getFFmpeg()

  progress(5, "Lecture du fichier…")
  const inputName = "input" + (file.name.match(/\.[a-zA-Z0-9]+$/)?.[0] ?? ".mp4")
  await ff.writeFile(inputName, await fetchFile(file))

  progress(10, "Extraction audio…")
  ff.on("progress", ({ progress: p }) => {
    const pct = 10 + Math.min(60, Math.max(0, p * 60))
    progress(pct, "Extraction audio…")
  })

  // Extract full audio as mp3 32kbps mono, then segment it.
  await ff.exec([
    "-i", inputName,
    "-vn",
    "-ac", "1",
    "-ar", "16000",
    "-b:a", "32k",
    "-f", "segment",
    "-segment_time", String(chunkSec),
    "-reset_timestamps", "1",
    "chunk_%03d.mp3",
  ])

  progress(75, "Découpage…")

  // List produced files
  const files = await ff.listDir("/")
  const chunkFiles = files
    .filter((f: any) => !f.isDir && /^chunk_\d+\.mp3$/.test(f.name))
    .map((f: any) => f.name)
    .sort()

  const chunks: AudioChunk[] = []
  for (let i = 0; i < chunkFiles.length; i++) {
    const name = chunkFiles[i]
    const data = (await ff.readFile(name)) as Uint8Array
    chunks.push({
      data,
      offsetSec: i * chunkSec,
      durationSec: chunkSec,
      index: i,
    })
    await ff.deleteFile(name)
    progress(75 + ((i + 1) / chunkFiles.length) * 20, `Chunk ${i + 1}/${chunkFiles.length}`)
  }

  try { await ff.deleteFile(inputName) } catch {}

  progress(100, "Prêt")
  return chunks
}
