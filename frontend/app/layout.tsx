import "./globals.css"

export const metadata = {
  title: "Clip Fortress — Turn your VODs into best clips",
  description: "Upload your VOD, get the best highlights automatically.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}
