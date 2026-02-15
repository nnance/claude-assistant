import { access, appendFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export interface LogInteractionParams {
  input: string
  category?: string
  confidence?: number
  reasoning?: string
  tags?: string[]
  stored_path?: string
  clarification?: string
  user_response?: string
}

export interface LogInteractionResult {
  success: boolean
  log_path?: string
  error?: string
}

export async function logInteraction(
  vaultPath: string,
  params: LogInteractionParams,
): Promise<LogInteractionResult> {
  try {
    const now = new Date()
    const logFileName = `${now.toISOString().split('T')[0]}.md`
    const logFilePath = join(vaultPath, '_system', 'logs', logFileName)

    const entryContent = formatLogEntry(params, now)

    if (await fileExists(logFilePath)) {
      await appendFile(logFilePath, entryContent, 'utf-8')
    } else {
      const header = formatLogHeader(now)
      await writeFile(logFilePath, header + entryContent, 'utf-8')
    }

    const relativePath = `_system/logs/${logFileName}`

    return {
      success: true,
      log_path: relativePath,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return {
      success: false,
      error: message,
    }
  }
}

function formatLogHeader(date: Date): string {
  const dateStr = date.toISOString().split('T')[0]
  return `# Interaction Log: ${dateStr}\n`
}

function formatLogEntry(params: LogInteractionParams, timestamp: Date): string {
  const timeStr = timestamp.toISOString().split('T')[1]?.split('.')[0] ?? '00:00:00'

  const lines: string[] = ['', '---', '', `## ${timeStr}`, '']

  lines.push(`**Input:** "${params.input}"`)
  lines.push('')

  if (params.clarification) {
    lines.push(`**Clarification requested:** "${params.clarification}"`)
    lines.push('')
    if (params.user_response) {
      lines.push(`**User response:** "${params.user_response}"`)
      lines.push('')
    }
  }

  if (params.category || params.confidence !== undefined || params.reasoning) {
    lines.push('**Categorization:**')
    if (params.category) {
      lines.push(`- Category: ${params.category}`)
    }
    if (params.confidence !== undefined) {
      lines.push(`- Confidence: ${params.confidence}%`)
    }
    if (params.reasoning) {
      lines.push(`- Reasoning: ${params.reasoning}`)
    }
    lines.push('')
  }

  if (params.tags && params.tags.length > 0) {
    lines.push('**Tags assigned:**')
    for (const tag of params.tags) {
      lines.push(`- ${tag}`)
    }
    lines.push('')
  }

  if (params.stored_path) {
    lines.push(`**Stored:** \`${params.stored_path}\``)
    lines.push('')
  }

  return lines.join('\n')
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}
