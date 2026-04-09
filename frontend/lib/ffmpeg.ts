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

export async function extractAndChunkAudio(
  file: File,
  opts: {
    chunkSec?: number
    onProgress?: (pct: number, label: string) => void
  } = {}
): Promise<AudioChunk[]> {
  const chunkSec = opts.chunkSec ?? 600
  const progress = opts.onProgress ?? (() => {})

  progress(0, "Chargement de FFmpeg…")
  const ff = await getFFmpeg()

  progress(5, "Lecture du fichier…")
  const ext = file.name.match(/\.[a-zA-Z0-9]+$/)?.[0] ?? ".mp4"
  const inputName = "input" + ext

  // Stream the file in chunks to avoid OOM on large files
  const CHUNK = 64 * 1024 * 1024 // 64 MB slices
  const total = file.size
  const parts: Uint8Array[] = []
  for (let offset = 0; offset < total; offset += CHUNK) {
    const slice = file.slice(offset, Math.min(offset + CHUNK, total))
    const buf = await slice.arrayBuffer()
    parts.push(new Uint8Array(buf))
    progress(5 + Math.round((offset / total) * 5), "Lecture du fichier…")
  }
  const fullBuf = new Uint8Array(total)
  let pos = 0
  for (const part of parts) { fullBuf.set(part, pos); pos += part.length }
  await ff.writeFile(inputName, fullBuf)

  // Step 1: Extract full audio as a single mp3 — more compatible than direct segmenting
  progress(10, "Extraction audio…")
  ff.on("progress", ({ progress: p }) => {
    const pct = 10 + Math.min(50, Math.max(0, p * 50))
    progress(pct, "Extraction audio…")
  })

  await ff.exec([
    "-i", inputName,
    "-vn",
    "-ac", "1",
    "-ar", "16000",
    "-b:a", "32k",
    "-y",
    "full_audio.mp3",
  ])

  try { await ff.deleteFile(inputName) } catch {}

  // Step 2: Get duration via probing the file size (estimate) then segment
  progress(62, "Découpage en chunks…")

  await ff.exec([
    "-i", "full_audio.mp3",
    "-f", "segment",
    "-segment_time", String(chunkSec),
    "-c", "copy",
    "-reset_timestamps", "1",
    "-y",
    "chunk_%03d.mp3",
  ])

  try { await ff.deleteFile("full_audio.mp3") } catch {}

  progress(75, "Lecture des chunks…")

  const files: any = await ff.listDir("/")
  const chunkFiles: string[] = (files as any[])
    .filter((f: any) => !f.isDir && /^chunk_\d+\.mp3$/.test(f.name))
    .map((f: any) => f.name as string)
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

  progress(100, "Prêt")
  return chunks
}
