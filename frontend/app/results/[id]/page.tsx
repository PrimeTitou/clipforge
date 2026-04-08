"use client"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { Job, Clip, Script } from "@/lib/types"
import { ClipCard } from "@/components/clip-card"
import { ScriptCard } from "@/components/script-card"

export default function ResultsPage() {
  const { id } = useParams<{ id: string }>()

  const { data: job } = useQuery({
    queryKey: ["job", id],
    queryFn: () => api.getJob(id) as Promise<Job>,
  })
  const { data: clips } = useQuery({
    queryKey: ["clips", id],
    queryFn: () => api.getClips(id) as Promise<Clip[]>,
  })
  const { data: scripts } = useQuery({
    queryKey: ["scripts", id],
    queryFn: () => api.getScripts(id) as Promise<Script[]>,
  })

  return (
    <main className="min-h-screen bg-white">
      <nav className="border-b border-gray-200 px-8 py-4 flex items-center gap-4">
        <a href="/" className="font-semibold text-gray-900 text-lg hover:text-gray-700 transition-colors">● ClipForge</a>
        {job && (
          <span className="text-sm text-gray-400">
            {job.channel_handle && `@${job.channel_handle} · `}
            {clips?.length ?? 0} clips · {scripts?.length ?? 0} scripts
          </span>
        )}
      </nav>

      <div className="max-w-6xl mx-auto px-4 pt-10 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Clips détectés {clips && `(${clips.length})`}
            </h2>
            <div className="flex flex-col gap-3">
              {clips?.map(clip => <ClipCard key={clip.id} clip={clip} />)}
              {!clips && <div className="text-gray-400 text-sm">Chargement...</div>}
              {clips?.length === 0 && <div className="text-gray-400 text-sm">Aucun clip détecté.</div>}
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Scripts générés {scripts && `(${scripts.length})`}
            </h2>
            <div className="flex flex-col gap-3">
              {scripts?.map((s, i) => <ScriptCard key={s.id} script={s} index={i} />)}
              {!scripts && <div className="text-gray-400 text-sm">Chargement...</div>}
              {scripts?.length === 0 && <div className="text-gray-400 text-sm">Aucun script généré.</div>}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
