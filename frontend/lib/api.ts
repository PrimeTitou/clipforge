const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, options)
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}

export const api = {
  analyzeChannel: (handle: string) =>
    request("/api/channel/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle }),
    }),

  getChannel: (handle: string) =>
    request<import("./types").Channel>(`/api/channel/${handle}`),

  submitVodUrl: (url: string, channel_handle?: string) =>
    request<{ job_id: string }>("/api/jobs/vod", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, channel_handle }),
    }),

  submitVodFile: (file: File, channel_handle?: string) => {
    const form = new FormData()
    form.append("file", file)
    if (channel_handle) form.append("channel_handle", channel_handle)
    return request<{ job_id: string }>("/api/jobs/upload", { method: "POST", body: form })
  },

  getJob: (id: string) =>
    request<import("./types").Job>(`/api/jobs/${id}`),

  getClips: (id: string) =>
    request<import("./types").Clip[]>(`/api/jobs/${id}/clips`),

  getScripts: (id: string) =>
    request<import("./types").Script[]>(`/api/jobs/${id}/scripts`),
}
