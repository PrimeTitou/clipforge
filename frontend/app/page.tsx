import { ChannelSearch } from "@/components/channel-search"

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white">
      <nav className="border-b border-gray-200 px-8 py-4 flex items-center justify-between">
        <span className="font-semibold text-gray-900 text-lg">● ClipForge</span>
        <a href="https://github.com" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">GitHub</a>
      </nav>

      <section className="flex flex-col items-center justify-center pt-32 pb-24 px-4 text-center">
        <h1 className="text-4xl font-semibold text-gray-900 mb-4 leading-tight">
          Turn your streams into<br />YouTube scripts. Instantly.
        </h1>
        <p className="text-lg text-gray-500 mb-10 max-w-md">
          Analyse ta chaîne, détecte tes meilleurs moments,<br />
          génère des scripts dans ton style.
        </p>
        <ChannelSearch />
      </section>

      <section className="border-t border-gray-200 py-12 px-8">
        <div className="max-w-3xl mx-auto grid grid-cols-3 gap-8 text-center">
          {[
            { icon: "🎬", label: "Détection de clips", desc: "Audio, transcription et vidéo analysés ensemble" },
            { icon: "✍️", label: "Scripts personnalisés", desc: "Dans le style exact de ta chaîne YouTube" },
            { icon: "⚡", label: "100% gratuit", desc: "Pas de compte requis, analyse complète" },
          ].map(f => (
            <div key={f.label}>
              <div className="text-2xl mb-2">{f.icon}</div>
              <div className="text-sm font-medium text-gray-900">{f.label}</div>
              <div className="text-sm text-gray-500 mt-1">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
