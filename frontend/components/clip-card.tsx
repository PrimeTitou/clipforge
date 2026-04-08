import type { Clip } from "@/lib/types"

const TYPE_EMOJI: Record<string, string> = {
  action: "⚔️", combat: "⚔️", death: "💀", treasure: "💰",
  funny: "😂", normal: "🎮",
}

function formatTs(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`
}

export function ClipCard({ clip }: { clip: Clip }) {
  const pct = Math.round(clip.score * 100)
  const barColor = pct >= 80 ? "bg-green-500" : pct >= 60 ? "bg-amber-400" : "bg-gray-300"
  return (
    <div className="border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-400 font-mono">{formatTs(clip.start_ts)}</span>
        <span className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">
          {TYPE_EMOJI[clip.clip_type] ?? "🎮"} {clip.clip_type}
        </span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-1.5 mb-2">
        <div className={`${barColor} h-1.5 rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">{pct}% pertinence</span>
        <span className="text-xs text-gray-400">{formatTs(clip.start_ts)} → {formatTs(clip.end_ts)}</span>
      </div>
      {clip.transcript_excerpt && (
        <p className="text-xs text-gray-500 mt-2 line-clamp-2 italic">"{clip.transcript_excerpt}"</p>
      )}
    </div>
  )
}
