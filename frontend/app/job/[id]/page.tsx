"use client"
import { useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { Job } from "@/lib/types"
import { JobProgress } from "@/components/job-progress"

export default function JobPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const { data: job } = useQuery({
    queryKey: ["job", id],
    queryFn: () => api.getJob(id) as Promise<Job>,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === "done" || status === "error" ? false : 2000
    },
  })

  useEffect(() => {
    if (job?.status === "done") {
      router.push(`/results/${id}`)
    }
  }, [job?.status, id, router])

  return (
    <main className="min-h-screen bg-white">
      <nav className="border-b border-gray-200 px-8 py-4">
        <a href="/" className="font-semibold text-gray-900 text-lg hover:text-gray-700 transition-colors">● ClipForge</a>
      </nav>
      <div className="max-w-2xl mx-auto px-4 pt-16 pb-24 flex flex-col items-center">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Analyse en cours</h1>
        <p className="text-gray-500 mb-10 text-center">Ça peut prendre quelques minutes selon la durée du live.</p>
        {job ? (
          job.status === "error" ? (
            <div className="text-red-500 text-sm border border-red-200 rounded-xl p-4 w-full max-w-lg">
              <strong>Erreur :</strong> {job.error_message}
            </div>
          ) : (
            <JobProgress job={job} />
          )
        ) : (
          <div className="text-gray-400">Chargement...</div>
        )}
      </div>
    </main>
  )
}
