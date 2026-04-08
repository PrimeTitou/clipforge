"use client"

import { useCallback, useEffect, useState } from "react"
import { useDropzone } from "react-dropzone"
import { supabase, type Job, type Clip } from "@/lib/supabase"
import { fmtTime } from "@/lib/utils"

type Phase = "idle" | "uploading" | "processing" | "done" | "error"

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
    setUploadPct(0)

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
    <main className="min-h-screen bg-white text-gray-900">
      <nav className="border-b border-gray-200 px-8 py-4 flex items-center justify-between">
        <span className="font-semibold text-lg">● ClipFortress</span>
        <span className="text-sm text-gray-500">Upload → Best clips</span>
      </nav>

      <section className="max-w-2xl mx-auto px-4 pt-24 pb-16">
        <h1 className="text-4xl font-semibold mb-3 text-center leading-tight">
          Découpe ta VOD en<br />meilleurs moments.
        </h1>
        <p className="text-gray-500 text-center mb-10">
          Upload ta vidéo, on te sort les top clips automatiquement.
        </p>

        {phase === "idle" && (
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
              isDragActive ? "border-indigo-500 bg-indigo-50" : "border-gray-300 hover:border-gray-400"
            }`}
          >
            <input {...getInputProps()} />
            <div className="text-4xl mb-3">📼</div>
            <div className="font-medium">
              {isDragActive ? "Lâche le fichier" : "Glisse ta VOD ici ou clique"}
            </div>
            <div className="text-sm text-gray-500 mt-1">video/audio · max 5 Go</div>
          </div>
        )}

        {phase === "uploading" && (
          <div className="border border-gray-200 rounded-xl p-8 text-center">
            <div className="text-sm text-gray-500 mb-3">Upload en cours…</div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 transition-all" style={{ width: `${uploadPct}%` }} />
            </div>
          </div>
        )}

        {phase === "processing" && job && (
          <div className="border border-gray-200 rounded-xl p-8">
            <div className="flex justify-between text-sm mb-3">
              <span className="font-medium capitalize">{job.status}…</span>
              <span className="text-gray-500">{job.progress}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 transition-all" style={{ width: `${job.progress}%` }} />
            </div>
            <div className="text-xs text-gray-400 mt-4 text-center">
              Transcription + détection en cours, ça peut prendre quelques minutes.
            </div>
          </div>
        )}

        {phase === "error" && (
          <div className="border border-red-200 bg-red-50 rounded-xl p-6">
            <div className="text-red-700 text-sm font-medium mb-2">Erreur</div>
            <div className="text-red-600 text-sm mb-4">{err}</div>
            <button onClick={reset} className="text-sm underline">Réessayer</button>
          </div>
        )}

        {phase === "done" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold">{clips.length} clips détectés</h2>
              <button onClick={reset} className="text-sm text-gray-500 hover:text-gray-900 underline">
                Nouvelle VOD
              </button>
            </div>
            {clips.length === 0 && (
              <div className="text-sm text-gray-500 text-center py-8">
                Aucun clip trouvé. Essaie une VOD plus longue ou plus animée.
              </div>
            )}
            <div className="space-y-3">
              {clips.map((c, i) => (
                <div key={c.id} className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-medium text-sm">#{i + 1} · {c.title}</div>
                    <div className="text-xs text-gray-500 font-mono">
                      {fmtTime(c.start_sec)} → {fmtTime(c.end_sec)}
                    </div>
                  </div>
                  {c.transcript && (
                    <div className="text-sm text-gray-600 line-clamp-3">{c.transcript}</div>
                  )}
                  <div className="text-xs text-gray-400 mt-2">score {c.score.toFixed(1)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  )
}
