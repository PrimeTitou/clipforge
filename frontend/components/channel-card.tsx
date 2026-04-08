import type { Channel } from "@/lib/types"

export function ChannelCard({ channel }: { channel: Channel }) {
  const formats = channel.style_profile?.top_formats?.slice(0, 4) ?? []
  return (
    <div className="border border-gray-200 rounded-xl p-5">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-lg font-bold text-gray-600 overflow-hidden flex-shrink-0">
          {channel.avatar_url
            ? <img src={channel.avatar_url} alt={channel.name} className="w-full h-full object-cover" />
            : channel.name[0]?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-gray-900 truncate">{channel.name}</div>
          <div className="text-sm text-gray-500">
            {channel.subscriber_count?.toLocaleString()} abonnés · {channel.video_count} vidéos
          </div>
        </div>
        <span className="text-green-500 text-sm font-medium flex-shrink-0">✓ Trouvée</span>
      </div>
      {formats.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {formats.map(f => (
            <span key={f} className="bg-gray-100 text-gray-600 text-xs rounded-full px-3 py-1">{f}</span>
          ))}
        </div>
      )}
    </div>
  )
}
