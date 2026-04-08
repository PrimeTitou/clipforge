"use client"

import { useCallback, useEffect, useState } from "react"
import { useDropzone } from "react-dropzone"
import { Zap, Target, Sparkles, Film, Upload } from "lucide-react"
import { Logo } from "@/components/logo"
import { supabase, type Job, type Clip } from "@/lib/supabase"
import { fmtTime } from "@/lib/utils"
import { extractAndChunkAudio } from "@/lib/ffmpeg"

type Phase = "idle" | "preparing" | "uploading" | "processing" | "done" | "error"

const BRAND = "Clip Fortress"

export default function HomePage() {
  const [phase, setPhase] = useState<Phase>("idle")
  const [job, setJob] = useState<Job | null>(null)
  const [clips, setClips] = useState<Clip[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [uploadPct, setUploadPct] = useState(0)
  const [prepLabel, setPrepLabel] = useState("")

  const onDrop = useCallback(async (files: File[]) => {
    const file = files[0]
    if (!file) return
    setErr(null)
    setPhase("preparing")
    setUploadPct(0)
    setPrepLabel("Chargement de FFmpeg…")

    try {
      // 1. Extract audio and chunk it client-side
      const chunks = await extractAndChunkAudio(file, {
        chunkSec: 600,
        onProgress: (pct, label) => {
          setUploadPct(pct)
          setPrepLabel(label)
        },
      })
      if (chunks.length === 0) throw new Error("No audio extracted")

      // 2. Create a job row
      const jobId = crypto.randomUUID()
      const prefix = `${jobId}`
      const chunkPaths: { path: string; offset: number }[] = []

      // 3. Upload each chunk to Storage
      setPhase("uploading")
      setPrepLabel("Upload des chunks…")
      for (let i = 0; i < chunks.length; i++) {
        const c = chunks[i]
        const chunkPath = `${prefix}/chunk_${String(i).padStart(3, "0")}.mp3`
        const blob = new Blob([c.data], { type: "audio/mpeg" })
        const { error: upErr } = await supabase.storage.from("vods").upload(chunkPath, blob, {
          contentType: "audio/mpeg",
          upsert: false,
        })
        if (upErr) throw upErr
        chunkPaths.push({ path: chunkPath, offset: c.offsetSec })
        setUploadPct(Math.round(((i + 1) / chunks.length) * 100))
      }

      // 4. Insert job row with chunk list
      const { data: jobRow, error: jobErr } = await supabase
        .from("jobs")
        .insert({
          id: jobId,
          storage_path: prefix,
          filename: file.name,
          status: "pending",
          progress: 5,
        })
        .select()
        .single()
      if (jobErr || !jobRow) throw jobErr ?? new Error("job insert failed")
      setJob(jobRow as Job)
      setPhase("processing")

      supabase.functions
        .invoke("process-vod", { body: { job_id: jobId, chunks: chunkPaths } })
        .catch((e) => console.error("invoke error", e))
    } catch (e: any) {
      console.error(e)
      setErr(e.message ?? String(e))
      setPhase("error")
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "video/*": [], "audio/*": [] },
    multiple: false,
    disabled: phase !== "idle" && phase !== "done" && phase !== "error",
  })

  useEffect(() => {
    if (phase !== "processing" || !job) return
    const t = setInterval(async () => {
      const { data } = await supabase.from("jobs").select("*").eq("id", job.id).single()
      if (!data) return
      setJob(data as Job)
      if (data.status === "done") {
        const { data: cs } = await supabase
          .from("clips")
          .select("*")
          .eq("job_id", job.id)
          .order("start_sec", { ascending: true })
        setClips((cs ?? []) as Clip[])
        setPhase("done")
      } else if (data.status === "error") {
        setErr(data.error ?? "unknown error")
        setPhase("error")
      }
    }, 2000)
    return () => clearInterval(t)
  }, [phase, job])

  const reset = () => {
    setPhase("idle")
    setJob(null)
    setClips([])
    setErr(null)
    setUploadPct(0)
  }

  return (
    <main className="h-screen bg-white relative overflow-hidden flex flex-col">
      <div className="dot-bg" />

      {/* Hero */}
      <section className="relative z-10 flex-1 flex flex-col items-center justify-center max-w-3xl w-full mx-auto px-6 text-center">
        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-[1.05] mb-4 appear-1">
          <span className="gradient-text">Transforme tes VODs</span>
          <br />
          <span className="gradient-text">en Scripts.</span>
        </h1>

        <p className="text-neutral-500 text-base sm:text-lg max-w-xl mx-auto mb-8 appear-2">
          Upload ta vidéo, laisse l'IA trouver les meilleurs moments
          et générer des scripts prêts à l'emploi.
        </p>

        <div className="appear-3 w-full max-w-2xl">
          {phase === "idle" && <Dropzone getRootProps={getRootProps} getInputProps={getInputProps} isDragActive={isDragActive} />}
          {phase === "preparing" && <UploadingCard pct={uploadPct} label={prepLabel} />}
          {phase === "uploading" && <UploadingCard pct={uploadPct} label={prepLabel || "Upload en cours…"} />}
          {phase === "processing" && job && <ProcessingCard job={job} />}
          {phase === "error" && <ErrorCard err={err} onReset={reset} />}
          {phase === "done" && <ResultsCard clips={clips} onReset={reset} />}
        </div>

        {/* Features */}
        {phase === "idle" && (
          <div className="w-full max-w-3xl mt-6 grid grid-cols-3 gap-3">
            {[
              { t: "Transcription", d: "Whisper Large v3", Icon: Zap },
              { t: "Scoring", d: "Mots hype, densité", Icon: Target },
              { t: "Top 10 clips", d: "Les moments forts", Icon: Sparkles },
            ].map(({ t, d, Icon }) => (
              <div key={t} className="border border-neutral-200 bg-white/70 backdrop-blur rounded-lg p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-100 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-emerald-600" strokeWidth={2.25} />
                </div>
                <div className="text-left min-w-0">
                  <div className="font-semibold text-xs text-neutral-900 truncate">{t}</div>
                  <div className="text-[10px] text-neutral-500 truncate">{d}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

function Dropzone({ getRootProps, getInputProps, isDragActive }: any) {
  return (
    <div
      {...getRootProps()}
      className={`relative rounded-2xl border-2 border-dashed p-8 cursor-pointer transition-all ${
        isDragActive
          ? "border-teal-400 bg-teal-50 scale-[1.02]"
          : "border-neutral-200 bg-white/70 backdrop-blur hover:border-neutral-300 hover:bg-white"
      }`}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center gap-2">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-100 flex items-center justify-center">
          <Upload className="w-5 h-5 text-emerald-600" strokeWidth={2.25} />
        </div>
        <div className="font-medium text-neutral-900">
          {isDragActive ? "Lâche ton fichier" : "Glisse ta VOD ou clique"}
        </div>
        <div className="text-xs text-neutral-500">video / audio · jusqu'à 5 Go</div>
      </div>
    </div>
  )
}

function UploadingCard({ pct, label }: { pct: number; label: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white/80 backdrop-blur p-8 shadow-sm">
      <div className="flex justify-between text-sm mb-3">
        <span className="text-neutral-700 font-medium">{label}</span>
        <span className="text-neutral-500 font-mono">{Math.round(pct)}%</span>
      </div>
      <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
        <div className="h-full progress-shimmer transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function ProcessingCard({ job }: { job: Job }) {
  const label =
    job.status === "transcribing" ? "Transcription avec Whisper" :
    job.status === "detecting" ? "Détection des meilleurs moments" :
    "Préparation"
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white/80 backdrop-blur p-10 shadow-sm">
      <div className="flex justify-between items-center text-sm mb-4">
        <span className="font-medium text-neutral-900 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
          {label}…
        </span>
        <span className="text-neutral-500 font-mono">{job.progress}%</span>
      </div>
      <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
        <div className="h-full progress-shimmer transition-all duration-500" style={{ width: `${job.progress}%` }} />
      </div>
      <div className="text-xs text-neutral-400 mt-6 text-center">
        Ça peut prendre quelques minutes selon la durée de la VOD.
      </div>
    </div>
  )
}

function ErrorCard({ err, onReset }: { err: string | null; onReset: () => void }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-left">
      <div className="text-red-700 text-sm font-semibold mb-2">Erreur</div>
      <div className="text-red-600/80 text-xs mb-4 font-mono break-all">{err}</div>
      <button onClick={onReset} className="text-sm px-4 py-2 rounded-lg border border-red-200 bg-white hover:bg-red-100 transition-colors">
        Réessayer
      </button>
    </div>
  )
}

function ResultsCard({ clips, onReset }: { clips: Clip[]; onReset: () => void }) {
  return (
    <div className="text-left">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-bold text-xl text-neutral-900">{clips.length} clips détectés</h2>
          <p className="text-xs text-neutral-500 mt-1">Triés par ordre chronologique</p>
        </div>
        <button onClick={onReset} className="text-sm px-4 py-2 rounded-lg border border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50 transition-colors">
          Nouvelle VOD
        </button>
      </div>

      {clips.length === 0 && (
        <div className="text-sm text-neutral-500 text-center py-16 border border-neutral-200 rounded-xl bg-white/70">
          Aucun clip détecté. Essaie une VOD plus longue ou plus animée.
        </div>
      )}

      <div className="space-y-3">
        {clips.map((c, i) => (
          <div key={c.id} className="group rounded-xl border border-neutral-200 bg-white/80 backdrop-blur p-5 hover:border-neutral-300 hover:shadow-sm transition-all">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-50 to-emerald-50 border border-neutral-200 flex items-center justify-center text-xs font-mono font-bold text-neutral-900">
                  {i + 1}
                </div>
                <div className="font-medium text-sm text-neutral-900">{c.title ?? `Clip ${i + 1}`}</div>
              </div>
              <div className="text-xs text-neutral-500 font-mono">
                {fmtTime(c.start_sec)} → {fmtTime(c.end_sec)}
              </div>
            </div>
            {c.transcript && (
              <div className="text-sm text-neutral-600 line-clamp-3 pl-11">{c.transcript}</div>
            )}
            <div className="text-xs text-neutral-400 mt-3 pl-11 font-mono">score {c.score.toFixed(1)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
