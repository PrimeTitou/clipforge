"use client"

import { useCallback, useEffect, useState } from "react"
import { useDropzone } from "react-dropzone"
import { Zap, Target, Sparkles, Film, Upload } from "lucide-react"
import { Logo } from "@/components/logo"
import { supabase, type Job, type Clip } from "@/lib/supabase"
import { fmtTime } from "@/lib/utils"

type Phase = "idle" | "uploading" | "processing" | "done" | "error"

const BRAND = "Clip Fortress"

export default function HomePage() {
  const [phase, setPhase] = useState<Phase>("idle")
  const [job, setJob] = useState<Job | null>(null)
  const [clips, setClips] = useState<Clip[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [uploadPct, setUploadPct] = useState(0)

  const onDrop = useCallback(async (files: File[]) => {
    const file = files[0]
    if (!file) return
    setErr(null)
    setPhase("uploading")
    setUploadPct(5)

    try {
      const path = `${crypto.randomUUID()}-${file.name}`
      const { error: upErr } = await supabase.storage.from("vods").upload(path, file, {
        contentType: file.type || "video/mp4",
        upsert: false,
      })
      if (upErr) throw upErr
      setUploadPct(100)

      const { data: jobRow, error: jobErr } = await supabase
        .from("jobs")
        .insert({ storage_path: path, filename: file.name, status: "pending", progress: 5 })
        .select()
        .single()
      if (jobErr || !jobRow) throw jobErr ?? new Error("job insert failed")
      setJob(jobRow as Job)
      setPhase("processing")

      supabase.functions.invoke("process-vod", { body: { job_id: jobRow.id } }).catch((e) => {
        console.error("invoke error", e)
      })
    } catch (e: any) {
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
    <main className="min-h-screen bg-white relative overflow-hidden">
      <div className="dot-bg" />

      <div className="h-16" />

      {/* Hero */}
      <section className="relative z-10 max-w-3xl mx-auto px-6 pt-32 pb-24 text-center">
        <h1 className="text-5xl sm:text-7xl font-bold tracking-tight leading-[1.05] mb-6 appear-1">
          <span className="gradient-text">Transforme tes VODs</span>
          <br />
          <span className="gradient-text">en Scripts.</span>
        </h1>

        <p className="text-neutral-500 text-lg max-w-xl mx-auto mb-12 appear-2">
          Upload ta vidéo, laisse l'IA trouver les meilleurs moments
          et générer des scripts prêts à l'emploi.
        </p>

        <div className="appear-3">
          {phase === "idle" && <Dropzone getRootProps={getRootProps} getInputProps={getInputProps} isDragActive={isDragActive} />}
          {phase === "uploading" && <UploadingCard pct={uploadPct} />}
          {phase === "processing" && job && <ProcessingCard job={job} />}
          {phase === "error" && <ErrorCard err={err} onReset={reset} />}
          {phase === "done" && <ResultsCard clips={clips} onReset={reset} />}
        </div>
      </section>

      {/* Features */}
      {phase === "idle" && (
        <section className="relative z-10 max-w-4xl mx-auto px-6 pb-24 grid sm:grid-cols-3 gap-4">
          {[
            { t: "Transcription rapide", d: "Whisper Large v3 sur GPU Groq", Icon: Zap },
            { t: "Scoring intelligent", d: "Mots hype, densité, ponctuation", Icon: Target },
            { t: "Top 10 clips", d: "Les moments les plus forts, triés", Icon: Sparkles },
          ].map(({ t, d, Icon }) => (
            <div key={t} className="border border-neutral-200 bg-white/70 backdrop-blur rounded-xl p-5 hover:border-neutral-300 hover:shadow-sm transition-all">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-teal-50 to-emerald-50 border border-neutral-200 flex items-center justify-center mb-3">
                <Icon className="w-4 h-4 text-teal-600" strokeWidth={2.25} />
              </div>
              <div className="font-semibold text-sm text-neutral-900">{t}</div>
              <div className="text-xs text-neutral-500 mt-1">{d}</div>
            </div>
          ))}
        </section>
      )}

      <footer className="relative z-10 border-t border-neutral-100 py-6 text-center text-xs text-neutral-400">
        {BRAND} — built with Supabase + Groq
      </footer>
    </main>
  )
}

function Dropzone({ getRootProps, getInputProps, isDragActive }: any) {
  return (
    <div
      {...getRootProps()}
      className={`relative rounded-2xl border-2 border-dashed p-14 cursor-pointer transition-all ${
        isDragActive
          ? "border-teal-400 bg-teal-50 scale-[1.02]"
          : "border-neutral-200 bg-white/70 backdrop-blur hover:border-neutral-300 hover:bg-white"
      }`}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center gap-3">
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-teal-50 to-emerald-50 border border-neutral-200 flex items-center justify-center">
          <Upload className="w-6 h-6 text-teal-600" strokeWidth={2.25} />
        </div>
        <div className="font-medium text-neutral-900">
          {isDragActive ? "Lâche ton fichier" : "Glisse ta VOD ou clique"}
        </div>
        <div className="text-xs text-neutral-500">video / audio · jusqu'à 5 Go</div>
      </div>
    </div>
  )
}

function UploadingCard({ pct }: { pct: number }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white/80 backdrop-blur p-10 shadow-sm">
      <div className="text-sm text-neutral-500 mb-4">Upload en cours…</div>
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
