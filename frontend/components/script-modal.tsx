"use client"
import { useState } from "react"
import type { Script } from "@/lib/types"

export function ScriptModal({ script, onClose }: { script: Script; onClose: () => void }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    const text = `TITRE:\n${script.title}\n\nHOOK:\n${script.hook}\n\nSCRIPT:\n${script.body}\n\nDESCRIPTION:\n${script.description}\n\nTAGS:\n${script.tags.join(", ")}`
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function exportTxt() {
    const text = `TITRE:\n${script.title}\n\nHOOK:\n${script.hook}\n\nSCRIPT:\n${script.body}\n\nDESCRIPTION:\n${script.description}\n\nTAGS:\n${script.tags.join(", ")}`
    const blob = new Blob([text], { type: "text/plain" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `script-${script.id.slice(0, 8)}.txt`
    a.click()
  }

  return (
    <div
      className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-lg font-semibold text-gray-900 leading-tight pr-4">{script.title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl flex-shrink-0">✕</button>
        </div>

        <div className="mb-4">
          <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Hook</div>
          <p className="text-sm text-indigo-600 italic">{script.hook}</p>
        </div>

        <div className="mb-4">
          <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Script</div>
          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{script.body}</p>
        </div>

        <div className="mb-4">
          <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Description YouTube</div>
          <p className="text-sm text-gray-600">{script.description}</p>
        </div>

        <div className="mb-6">
          <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Tags</div>
          <div className="flex flex-wrap gap-1">
            {script.tags.map(t => (
              <span key={t} className="bg-gray-100 text-gray-600 text-xs rounded-full px-2 py-0.5">{t}</span>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={copy}
            className="flex-1 border border-gray-200 rounded-xl py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            {copied ? "✓ Copié !" : "📋 Copier"}
          </button>
          <button
            onClick={exportTxt}
            className="flex-1 bg-gray-900 text-white rounded-xl py-2 text-sm font-medium hover:bg-gray-700 transition-colors"
          >
            ↓ Exporter .txt
          </button>
        </div>
      </div>
    </div>
  )
}
