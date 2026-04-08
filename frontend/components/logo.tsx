export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cf-g" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0d9488" />
          <stop offset="1" stopColor="#10b981" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="8" fill="url(#cf-g)" />
      {/* Fortress crenellation */}
      <path
        d="M8 11h2v-2h3v2h3v-2h3v2h3v-2h2v12H8z"
        fill="white"
        fillOpacity="0.95"
      />
      {/* Play cut */}
      <path d="M14 15l5 3-5 3z" fill="#0d9488" />
    </svg>
  )
}
