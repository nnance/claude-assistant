import * as fs from 'node:fs'
import * as path from 'node:path'

const MAX_MEMORY_CHARS = 4000

export class MemoryStore {
  private basePath: string

  constructor(memoryPath: string) {
    this.basePath = path.resolve(memoryPath)
  }

  get dailyDir(): string {
    return path.join(this.basePath, 'daily')
  }

  ensureDirectories(): void {
    fs.mkdirSync(this.dailyDir, { recursive: true })
  }

  getDailyLogPath(date: Date = new Date()): string {
    const yyyy = date.getFullYear()
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const dd = String(date.getDate()).padStart(2, '0')
    return path.join(this.dailyDir, `${yyyy}-${mm}-${dd}.md`)
  }

  getTodayLog(): string {
    return this.readLogFile(this.getDailyLogPath())
  }

  getRecentLogs(days: number): string {
    const logs: string[] = []
    const now = new Date()

    for (let i = 0; i < days; i++) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      const content = this.readLogFile(this.getDailyLogPath(date))
      if (content) {
        const yyyy = date.getFullYear()
        const mm = String(date.getMonth() + 1).padStart(2, '0')
        const dd = String(date.getDate()).padStart(2, '0')
        logs.push(`# ${yyyy}-${mm}-${dd}\n\n${content}`)
      }
    }

    return logs.join('\n\n')
  }

  getMemoryContext(): string {
    const content = this.getRecentLogs(2)
    if (!content) return ''
    return this.truncateFromTop(content, MAX_MEMORY_CHARS)
  }

  private readLogFile(filePath: string): string {
    try {
      return fs.readFileSync(filePath, 'utf-8')
    } catch {
      return ''
    }
  }

  private truncateFromTop(content: string, maxChars: number): string {
    if (content.length <= maxChars) return content
    const truncated = content.slice(content.length - maxChars)
    const firstNewline = truncated.indexOf('\n')
    if (firstNewline > 0) {
      return `...(earlier entries truncated)\n${truncated.slice(firstNewline + 1)}`
    }
    return `...(earlier entries truncated)\n${truncated}`
  }
}
