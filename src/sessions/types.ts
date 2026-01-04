export interface Session {
  id: string
  slack_thread_ts: string
  slack_channel_id: string
  agent_session_id: string | null
  created_at: Date
  last_active: Date
}

export interface SessionRow {
  id: string
  slack_thread_ts: string
  slack_channel_id: string
  agent_session_id: string | null
  created_at: string
  last_active: string
}

export interface CreateSessionInput {
  slack_thread_ts: string
  slack_channel_id: string
}
