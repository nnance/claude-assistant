export type JobType = 'one_shot' | 'recurring'
export type JobStatus = 'active' | 'paused' | 'completed' | 'failed'

export interface ScheduledJob {
  id: string
  name: string
  description: string | null
  job_type: JobType
  schedule: string // ISO timestamp or cron expression
  next_run_at: string // ISO timestamp
  last_run_at: string | null
  status: JobStatus
  prompt: string
  failure_count: number
  created_at: string
  updated_at: string
}

export interface CreateJobInput {
  name: string
  description?: string
  job_type: JobType
  schedule: string
  prompt: string
}
