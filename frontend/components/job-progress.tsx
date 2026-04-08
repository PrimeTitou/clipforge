import type { Job } from "@/lib/types"

const STEPS = [
  "Téléchargement VOD",
  "Transcription audio",
  "Analyse vidéo (frames)",
  "Détection de clips",
  "Analyse chaîne YouTube",
  "Génération des scripts",
]

export function JobProgress({ job }: { job: Job }) {
  return (
    <div className="w-full max-w-lg">
      <div className="border border-gray-200 rounded-xl divide-y divide-gray-100">
        {STEPS.map((step, i) => {
          const stepNum = i + 1
          const done = job.step_current > stepNum
          const active = job.step_current === stepNum
          const pending = job.step_current < stepNum
          return (
            <div key={step} className="flex items-center gap-4 px-5 py-4">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${done ? "bg-green-500 text-white" : active ? "bg-indigo-500 text-white" : "bg-gray-100 text-gray-400"}`}>
                {done ? "✓" : stepNum}
              </span>
              <span className={`text-sm flex-1 ${pending ? "text-gray-400" : "text-gray-900"}`}>{step}</span>
              {active && (
                <span className="flex items-center gap-1 text-xs text-indigo-500">
                  <span className="inline-block w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
                  En cours
                </span>
              )}
              {done && <span className="text-xs text-green-500">✓</span>}
            </div>
          )
        })}
      </div>
      <div className="mt-6">
        <div className="flex justify-between text-sm text-gray-500 mb-2">
          <span>Progression</span>
          <span>{Math.round(job.progress)}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div
            className="bg-indigo-500 h-2 rounded-full transition-all duration-500"
            style={{ width: `${job.progress}%` }}
          />
        </div>
      </div>
    </div>
  )
}
