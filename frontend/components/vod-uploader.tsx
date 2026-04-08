"use client"
import { useState, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import { api } from "@/lib/api"
import { useRouter } from "next/navigation"

export function VodUploader({ channelHandle }: { channelHandle: string }) {
  const [tab, setTab] = useState<"url" | "file">("url")
  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function submitUrl(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim()) return
    setLoading(true)
    setError(null)
    try {
      const { job_id } = await api.submitVodUrl(url.trim(), channelHandle) as { job_id: string }
      router.push(`/job/${job_id}`)
    } catch {
      setError("Impossible de traiter cette URL.")
    } finally {
      setLoading(false)
    }
  }

  const onDrop = useCallback(async (files: File[]) => {
    if (!files[0]) return
    setLoading(true)
    setError(null)
    try {
      const { job_id } = await api.submitVodFile(files[0], channelHandle) as { job_id: string }
      router.push(`/job/${job_id}`)
    } catch {
      setError("Erreur lors de l'upload.")
    } finally {
      setLoading(false)
    }
  }, [channelHandle, router])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "video/*": [".mp4", ".mkv", ".mov", ".avi"] },
    maxFiles: 1,
    disabled: loading,
  })

  return (
    <div className="w-full max-w-2xl">
      <div className="flex gap-2 mb-4">
        {(["url", "file"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            {t === "url" ? "🔗 URL du live" : "📁 Fichier vidéo"}
          </button>
        ))}
      </div>

      {tab === "url" ? (
        <form onSubmit={submitUrl} className="flex gap-3">
          <input
            className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-base placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="https://twitch.tv/videos/... ou youtube.com/watch?v=..."
            value={url}
            onChange={e => setUrl(e.target.value)}
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="bg-gray-900 text-white rounded-xl px-6 py-3 font-medium hover:bg-gray-700 disabled:opacity-40 transition-colors whitespace-nowrap"
          >
            {loading ? "Envoi..." : "Lancer →"}
          </button>
        </form>
      ) : (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${isDragActive ? "border-indigo-400 bg-indigo-50" : "border-gray-300 hover:border-gray-400"} ${loading ? "opacity-50 pointer-events-none" : ""}`}
        >
          <input {...getInputProps()} />
          <div className="text-3xl mb-3">↑</div>
          <div className="text-base font-medium text-gray-700">
            {isDragActive ? "Dépose le fichier ici" : "Glisse ta vidéo ici"}
          </div>
          <div className="text-sm text-gray-400 mt-1">ou clique pour choisir · MP4, MKV, MOV</div>
          {loading && <div className="text-sm text-indigo-500 mt-3">Upload en cours...</div>}
        </div>
      )}

      {error && <p className="text-sm text-red-500 mt-3">{error}</p>}
    </div>
  )
}
