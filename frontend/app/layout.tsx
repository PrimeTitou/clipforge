import "./globals.css"

export const metadata = {
  title: "ClipFortress",
  description: "Découpe ta VOD en meilleurs moments automatiquement.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}
