export interface Channel {
  handle: string
  name: string
  avatar_url: string | null
  subscriber_count: number | null
  video_count: number | null
  style_profile: {
    top_formats: string[]
    avg_title_length: number
    top_videos: { title: string; view_count: number }[]
    video_count: number
  } | null
  scraped_at: string
}

export interface Job {
  id: string
  status: "pending" | "running" | "done" | "error"
  step_current: number
  progress: number
  channel_handle: string | null
  error_message: string | null
  created_at: string
}

export interface Clip {
  id: string
  start_ts: number
  end_ts: number
  score: number
  clip_type: "action" | "combat" | "death" | "treasure" | "funny" | "normal"
  transcript_excerpt: string | null
}

export interface Script {
  id: string
  title: string
  hook: string
  body: string
  description: string
  tags: string[]
}
