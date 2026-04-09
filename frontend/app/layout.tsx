import "./globals.css"

export const metadata = {
  title: "Script Fortress",
  description: "Upload ta VOD, récupère un script complet avec angles, hooks et moments clés.",
  icons: { icon: "/icon.svg" },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}
