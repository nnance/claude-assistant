import { readFile, readdir } from 'node:fs/promises'
import { join, normalize, resolve } from 'node:path'

const CONTENT_FOLDERS = ['Tasks', 'Ideas', 'Reference', 'Projects', 'Inbox', 'Archive']

export interface VaultListParams {
  folder?: string
  tags?: string[]
  limit?: number
}

export interface VaultFileInfo {
  filepath: string
  title: string
  tags: string[]
  created: string
}

export interface VaultListResult {
  success: boolean
  files?: VaultFileInfo[]
  error?: string
}

export async function vaultList(
  vaultPath: string,
  params: VaultListParams,
): Promise<VaultListResult> {
  try {
    const { folder, tags, limit = 20 } = params

    if (folder && !isValidFolderPath(vaultPath, folder)) {
      return {
        success: false,
        error: 'Invalid folder path: directory traversal not allowed',
      }
    }

    const foldersToScan = folder ? [folder] : CONTENT_FOLDERS
    const allFiles: VaultFileInfo[] = []

    for (const folderName of foldersToScan) {
      const folderPath = join(vaultPath, folderName)
      try {
        const files = await scanFolder(folderPath, folderName)
        allFiles.push(...files)
      } catch {
        // Folder doesn't exist, skip
      }
    }

    let filtered = allFiles
    if (tags && tags.length > 0) {
      filtered = allFiles.filter((file) => tags.every((tag) => file.tags.includes(tag)))
    }

    filtered.sort((a, b) => b.created.localeCompare(a.created))

    const result = filtered.slice(0, limit)

    return {
      success: true,
      files: result,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return {
      success: false,
      error: message,
    }
  }
}

async function scanFolder(folderPath: string, folderName: string): Promise<VaultFileInfo[]> {
  const entries = await readdir(folderPath)
  const files: VaultFileInfo[] = []

  for (const entry of entries) {
    if (!entry.endsWith('.md')) continue

    const filepath = join(folderPath, entry)
    const content = await readFile(filepath, 'utf-8')
    const metadata = parseFrontmatter(content)
    const title = extractTitle(content) || entry.replace('.md', '')

    files.push({
      filepath: `${folderName}/${entry}`,
      title,
      tags: metadata.tags || [],
      created: metadata.created || '',
    })
  }

  return files
}

interface FrontmatterData {
  created?: string
  tags?: string[]
}

function parseFrontmatter(content: string): FrontmatterData {
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match?.[1]) return {}

  const yaml = match[1]
  const result: FrontmatterData = {}

  const createdMatch = yaml.match(/created:\s*(.+)/)
  if (createdMatch?.[1]) {
    result.created = createdMatch[1].trim()
  }

  const tags: string[] = []

  const multilineMatch = yaml.match(/tags:\s*\n((?:\s+-\s+.+\n?)+)/)
  if (multilineMatch?.[1]) {
    const tagLines = multilineMatch[1].split('\n')
    for (const line of tagLines) {
      const tagMatch = line.match(/^\s+-\s+(.+)/)
      if (tagMatch?.[1]) {
        tags.push(tagMatch[1].trim())
      }
    }
  } else {
    const inlineMatch = yaml.match(/tags:\s*\[([^\]]*)\]/)
    if (inlineMatch?.[1] !== undefined) {
      const tagStr = inlineMatch[1]
      if (tagStr.trim()) {
        tags.push(
          ...tagStr
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
        )
      }
    }
  }

  if (tags.length > 0) {
    result.tags = tags
  }

  return result
}

function extractTitle(content: string): string | null {
  const match = content.match(/^---\n[\s\S]*?\n---\n+# (.+)/m)
  if (match?.[1]) {
    return match[1].trim()
  }

  const h1Match = content.match(/^# (.+)/m)
  if (h1Match?.[1]) {
    return h1Match[1].trim()
  }

  return null
}

function isValidFolderPath(vaultPath: string, folder: string): boolean {
  const normalized = normalize(folder)

  if (normalized.startsWith('..') || normalized.includes('../')) {
    return false
  }

  const vaultRoot = resolve(vaultPath)
  const resolvedPath = resolve(vaultPath, normalized)

  return resolvedPath.startsWith(`${vaultRoot}/`) || resolvedPath === vaultRoot
}
