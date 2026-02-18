import { computeNextRun } from './cron.js'
import { SchedulerStore } from './store.js'
import type { JobType } from './types.js'

// biome-ignore lint/complexity/useLiteralKeys: TypeScript noPropertyAccessFromIndexSignature requires bracket notation
const DB_PATH = process.env['PROACTIVE_SCHEDULER_DB_PATH'] || './data/scheduler.db'

function jsonError(message: string): never {
  console.error(JSON.stringify({ error: message }))
  process.exit(1)
}

function jsonOut(data: unknown): void {
  console.log(JSON.stringify(data, null, 2))
}

const [command, ...args] = process.argv.slice(2)
const store = new SchedulerStore(DB_PATH)

try {
  switch (command) {
    case 'list': {
      const includeAll = args[0] === 'all'
      jsonOut(store.list(includeAll))
      break
    }

    case 'create': {
      const [name, jobType, schedule, prompt] = args
      if (!name || !jobType || !schedule || !prompt) {
        jsonError('Usage: create <name> <one_shot|recurring> <schedule> <prompt>')
      }
      if (jobType !== 'one_shot' && jobType !== 'recurring') {
        jsonError(`Invalid job_type: ${jobType}. Must be 'one_shot' or 'recurring'.`)
      }

      let nextRunAt: Date
      if (jobType === 'recurring') {
        nextRunAt = computeNextRun(schedule)
      } else {
        nextRunAt = new Date(schedule)
        if (Number.isNaN(nextRunAt.getTime())) {
          jsonError(`Invalid ISO timestamp: ${schedule}`)
        }
      }

      const job = store.create({ name, job_type: jobType as JobType, schedule, prompt }, nextRunAt)
      jsonOut(job)
      break
    }

    case 'get': {
      const id = args[0]
      if (!id) jsonError('Usage: get <job-id>')
      const job = store.getById(id)
      if (!job) jsonError(`Job not found: ${id}`)
      jsonOut(job)
      break
    }

    case 'pause': {
      const id = args[0]
      if (!id) jsonError('Usage: pause <job-id>')
      const job = store.getById(id)
      if (!job || job.status !== 'active') jsonError(`Job not found or not active: ${id}`)
      store.updateStatus(id, 'paused')
      jsonOut(store.getById(id))
      break
    }

    case 'resume': {
      const id = args[0]
      if (!id) jsonError('Usage: resume <job-id>')
      const job = store.getById(id)
      if (!job || job.status !== 'paused') jsonError(`Job not found or not paused: ${id}`)
      store.updateStatus(id, 'active')
      jsonOut(store.getById(id))
      break
    }

    case 'delete': {
      const id = args[0]
      if (!id) jsonError('Usage: delete <job-id>')
      const deleted = store.delete(id)
      if (!deleted) jsonError(`Job not found: ${id}`)
      jsonOut({ deleted: true, id })
      break
    }

    default:
      jsonError(
        `Unknown command: ${command ?? '(none)'}. Available: list, create, get, pause, resume, delete`,
      )
  }
} finally {
  store.close()
}
