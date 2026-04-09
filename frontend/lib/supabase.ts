import { createClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(url, key)

export type Job = {
  id: string
  status: "pending" | "transcribing" | "writing" | "done" | "error"
  progress: number
  error: string | null
  storage_path: string
  filename: string | null
  title: string | null
  script: string | null
  transcript: string | null
  rate_limit_until: string | null
  created_at: string
  updated_at: string
}
