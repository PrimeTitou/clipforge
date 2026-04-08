"use client"
import { useState } from "react"
import type { Script } from "@/lib/types"
import { ScriptModal } from "./script-modal"

export function ScriptCard({ script, index }: { script: Script; index: number }) {
  const [open, setOpen] = useState(false)

  function quickCopy() {
    const text = `${script.title}\n\n${script.hook}\n\n${script.body}`
    navigator.clipboard.writeText(text)
  }

  return (
    <>
      <div className="border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors">
        <div className="text-xs text-gray-400 mb-1">Script #{index + 1}</div>
        <div className="font-medium text-gray-900 mb-2 leading-snug">{script.title}</div>
        <p className="text-xs text-indigo-500 italic mb-4 line-clamp-2">"{script.hook}"</p>
        <div className="flex gap-2">
          <button
            onClick={() => setOpen(true)}
            className="flex-1 border border-gray-200 rounded-lg py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Voir le script
          </button>
          <button
            onClick={quickCopy}
            className="flex-1 bg-gray-900 text-white rounded-lg py-1.5 text-xs font-medium hover:bg-gray-700 transition-colors"
          >
            📋 Copier
          </button>
        </div>
      </div>
      {open && <ScriptModal script={script} onClose={() => setOpen(false)} />}
    </>
  )
}
