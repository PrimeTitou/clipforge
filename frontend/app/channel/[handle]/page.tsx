"use client"
import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { api } from "@/lib/api"
import type { Channel } from "@/lib/types"
import { ChannelCard } from "@/components/channel-card"
import { VodUploader } from "@/components/vod-uploader"

export default function ChannelPage() {
  const { handle } = useParams<{ handle: string }>()
  const [channel, setChannel] = useState<Channel | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let tries = 0
    const poll = async () => {
      try {
        const data = await api.getChannel(handle) as Channel
        setChannel(data)
        setLoading(false)
      } catch {
        if (tries < 15) {
          tries++
          setTimeout(poll, 2000)
        } else {
          setLoading(false)
        }
      }
    }
    poll()
  }, [handle])

  return (
    <main className="min-h-screen bg-white">
      <nav className="border-b border-gray-200 px-8 py-4">
        <a href="/" className="font-semibold text-gray-900 text-lg hover:text-gray-700 transition-colors">● ClipForge</a>
      </nav>
      <div className="max-w-2xl mx-auto px-4 pt-12 pb-24">
        {loading ? (
          <div className="text-center">
            <div className="text-gray-500 mb-3">Analyse de la chaîne en cours...</div>
            <div className="w-full bg-gray-100 rounded-full h-1.5">
              <div className="bg-indigo-500 h-1.5 rounded-full animate-pulse w-1/2" />
            </div>
          </div>
        ) : channel ? (
          <>
            <ChannelCard channel={channel} />
            <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-6">Upload ta VOD</h2>
            <VodUploader channelHandle={handle} />
          </>
        ) : (
          <div className="text-center">
            <p className="text-red-500 mb-4">Impossible de charger la chaîne.</p>
            <a href="/" className="text-sm text-gray-500 hover:text-gray-900">← Retour</a>
          </div>
        )}
      </div>
    </main>
  )
}
