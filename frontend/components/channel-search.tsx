"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api"

export function ChannelSearch() {
  const [value, setValue] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handle = value.trim()
    .replace(/^https?:\/\/(www\.)?youtube\.com\/@?/, "")
    .replace(/^@/, "")
    .split("/")[0]

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!handle) return
    setLoading(true)
    setError(null)
    try {
      await api.analyzeChannel(handle)
      router.push(`/channel/${handle}`)
    } catch {
      setError("Chaîne introuvable. Vérifie le nom ou l'URL.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col items-center gap-4 w-full max-w-xl">
      <div className="w-full">
        <input
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
          placeholder="youtube.com/@tonpseudo ou nom de chaîne..."
          value={value}
          onChange={e => setValue(e.target.value)}
          disabled={loading}
        />
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={loading || !handle}
        className="bg-gray-900 text-white rounded-xl px-8 py-3 text-base font-medium hover:bg-gray-700 disabled:opacity-40 transition-colors"
      >
        {loading ? "Analyse en cours..." : "Analyser ma chaîne →"}
      </button>
    </form>
  )
}
