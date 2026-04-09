"use client"

import { useCallback, useEffect, useState } from "react"
import { useDropzone } from "react-dropzone"
import { Zap, Target, Sparkles, Upload, FileText, Copy, Check, AlignLeft, Crosshair, Lightbulb, Anchor, MapPin, MessageSquare, Shuffle, PenLine } from "lucide-react"
import { supabase, type Job } from "@/lib/supabase"
import { extractAndChunkAudio } from "@/lib/ffmpeg"

type Phase = "idle" | "preparing" | "uploading" | "processing" | "done" | "error"

const BRAND = "Script Fortress"

export default function HomePage() {
  const [phase, setPhase] = useState<Phase>("idle")
  const [job, setJob] = useState<Job | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [uploadPct, setUploadPct] = useState(0)
  const [prepLabel, setPrepLabel] = useState("")

  const handleFile = useCallback(async (file: File) => {
    setErr(null)
    setPhase("preparing")
    setUploadPct(0)
    setPrepLabel("Chargement de FFmpeg…")

    try {
      const chunks = await extractAndChunkAudio(file, {
        chunkSec: 600,
        onProgress: (pct, label) => {
          setUploadPct(pct)
          setPrepLabel(label)
        },
      })
      if (chunks.length === 0) throw new Error("Aucun audio extrait")

      const jobId = crypto.randomUUID()
      const prefix = `${jobId}`
      const chunkPaths: { path: string; offset: number }[] = []

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

  const onDrop = useCallback((files: File[]) => {
    if (files[0]) handleFile(files[0])
  }, [handleFile])

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
      if (data.status === "done") setPhase("done")
      else if (data.status === "error") {
        setErr(data.error ?? "unknown error")
        setPhase("error")
      }
    }, 2000)
    return () => clearInterval(t)
  }, [phase, job])

  const reset = () => {
    setPhase("idle")
    setJob(null)
    setErr(null)
    setUploadPct(0)
  }

  const isLanding = phase === "idle" || phase === "error"

  return (
    <main className={`${phase === "done" ? "min-h-screen overflow-auto" : "h-screen overflow-hidden"} bg-white relative flex flex-col`}>
      <div className="dot-bg" />

      {phase !== "done" && (
        <section className="relative z-10 flex-1 flex flex-col items-center justify-center max-w-3xl w-full mx-auto px-6 text-center">
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-[1.05] mb-4 appear-1">
            <span className="gradient-text">Transforme tes VODs</span>
            <br />
            <span className="gradient-text">en Scripts.</span>
          </h1>

          <p className="text-neutral-500 text-base sm:text-lg max-w-xl mx-auto mb-8 appear-2">
            Donne un titre, upload ta vidéo, et récupère un script complet
            avec angles, hooks, moments clés et punchlines.
          </p>

          <div className="appear-3 w-full max-w-2xl">
            {isLanding && (
              <>
                <Dropzone
                  getRootProps={getRootProps}
                  getInputProps={getInputProps}
                  isDragActive={isDragActive}
                />
                {err && (
                  <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
                    {err}
                  </div>
                )}
              </>
            )}
            {phase === "preparing" && <UploadingCard pct={uploadPct} label={prepLabel} />}
            {phase === "uploading" && <UploadingCard pct={uploadPct} label={prepLabel || "Upload en cours…"} />}
            {phase === "processing" && job && <ProcessingCard job={job} />}
          </div>

          {isLanding && (
            <div className="w-full max-w-3xl mt-6 grid grid-cols-3 gap-3">
              {[
                { t: "Transcription", d: "Whisper Large v3", Icon: Zap },
                { t: "Analyse IA", d: "Llama 70B", Icon: Target },
                { t: "Script complet", d: "Hooks, angles, punchlines", Icon: Sparkles },
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
      )}

      {phase === "done" && job && <ScriptView job={job} onReset={reset} />}
    </main>
  )
}

function Dropzone({ getRootProps, getInputProps, isDragActive }: any) {
  return (
    <div
      {...getRootProps()}
      className={`relative rounded-2xl border-2 border-dashed p-8 transition-all ${
        isDragActive
          ? "border-emerald-400 bg-emerald-50 scale-[1.02] cursor-pointer"
          : "border-neutral-200 bg-white/70 backdrop-blur hover:border-emerald-300 hover:bg-white cursor-pointer"
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
    job.status === "writing" ? "Génération du script avec Llama" :
    "Préparation"
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white/80 backdrop-blur p-8 shadow-sm">
      <div className="flex justify-between items-center text-sm mb-3">
        <span className="font-medium text-neutral-900 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          {label}…
        </span>
        <span className="text-neutral-500 font-mono">{job.progress}%</span>
      </div>
      <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
        <div className="h-full progress-shimmer transition-all duration-500" style={{ width: `${job.progress}%` }} />
      </div>
      <div className="text-xs text-neutral-400 mt-4 text-center">
        Ça peut prendre quelques minutes selon la durée de la VOD.
      </div>
    </div>
  )
}

const SECTION_ICONS: Record<string, React.ReactNode> = {
  "Résumé":          <AlignLeft className="w-4 h-4 text-emerald-600" strokeWidth={2} />,
  "Angle":           <Crosshair className="w-4 h-4 text-emerald-600" strokeWidth={2} />,
  "Idées de titres": <Lightbulb className="w-4 h-4 text-emerald-600" strokeWidth={2} />,
  "Hooks d'intro":   <Anchor className="w-4 h-4 text-emerald-600" strokeWidth={2} />,
  "Moments clés":    <MapPin className="w-4 h-4 text-emerald-600" strokeWidth={2} />,
  "Punchlines":      <MessageSquare className="w-4 h-4 text-emerald-600" strokeWidth={2} />,
  "Transitions":     <Shuffle className="w-4 h-4 text-emerald-600" strokeWidth={2} />,
  "Pistes de script":<PenLine className="w-4 h-4 text-emerald-600" strokeWidth={2} />,
}

function parseScript(raw: string) {
  const lines = raw.split("\n")
  const sections: { title: string; body: string }[] = []
  let current: { title: string; body: string } | null = null

  for (const line of lines) {
    const match = line.match(/^#{1,3}\s+(.+)$/)
    if (match) {
      if (current) sections.push(current)
      current = { title: match[1].trim(), body: "" }
    } else {
      if (current) current.body += (current.body ? "\n" : "") + line
      else if (line.trim()) {
        current = { title: "", body: line }
      }
    }
  }
  if (current) sections.push(current)
  return sections
}

function ScriptView({ job, onReset }: { job: Job; onReset: () => void }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    if (!job.script) return
    await navigator.clipboard.writeText(job.script)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const sections = parseScript(job.script ?? "")

  return (
    <section className="relative z-10 max-w-4xl w-full mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-xs text-neutral-500">{job.filename}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={copy}
            className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg border border-neutral-200 bg-white hover:border-emerald-300 hover:bg-emerald-50 transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            {copied ? "Copié" : "Copier"}
          </button>
          <button
            onClick={onReset}
            className="text-sm px-4 py-2 rounded-lg border border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50 transition-colors"
          >
            Nouvelle VOD
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {sections.map((s, i) => (
          <div key={i} className="rounded-2xl border border-neutral-200 bg-white/90 backdrop-blur px-7 py-5 shadow-sm">
            {s.title && (
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-md bg-emerald-50 border border-emerald-100 flex items-center justify-center flex-shrink-0">
                  {SECTION_ICONS[s.title] ?? <FileText className="w-4 h-4 text-emerald-600" strokeWidth={2} />}
                </div>
                <h2 className="font-semibold text-sm text-neutral-900">{s.title}</h2>
              </div>
            )}
            <div className="text-[14px] leading-relaxed text-neutral-700 whitespace-pre-wrap">{s.body.trim()}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
