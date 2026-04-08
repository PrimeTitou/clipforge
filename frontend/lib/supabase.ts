import { createClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(url, key)

export type Job = {
  id: string
  status: "pending" | "transcribing" | "detecting" | "done" | "error"
  progress: number
  error: string | null
  storage_path: string
  filename: string | null
  created_at: string
  updated_at: string
}

export type Clip = {
  id: string
  job_id: string
  start_sec: number
  end_sec: number
  score: number
  title: string | null
  transcript: string | null
}
