# ClipForge

Transforme tes VODs de stream en scripts YouTube personnalisés.

## Démarrage rapide

### Prérequis
- Docker + Docker Compose
- Clés API : Groq, Gemini

### Setup

1. Copie et configure le .env :
```bash
cp backend/.env.example backend/.env
# Remplis GROQ_API_KEY, GEMINI_API_KEY, DATABASE_URL, etc.
```

2. Lance tout :
```bash
docker-compose up --build
```

3. Ouvre http://localhost:3000

## Stack
- **Backend** : FastAPI + Celery + Redis
- **Frontend** : Next.js 14 + Tailwind CSS
- **DB** : PostgreSQL (Supabase)
- **IA** : Groq Whisper + llama-3.3-70b + Gemini 2.0 Flash Vision

## Pipeline d'analyse
1. Download VOD (yt-dlp)
2. Transcription audio (Groq Whisper)
3. Analyse frames vidéo (Gemini Vision)
4. Détection clips (score composite)
5. Analyse chaîne YouTube (yt-dlp scraping)
6. Génération scripts (Groq llama-3.3-70b)
