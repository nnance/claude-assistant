import { readFile } from 'node:fs/promises'
import { join, normalize, resolve } from 'node:path'

export interface VaultReadParams {
  filepath: string // Path relative to vault root, e.g., "Tasks/2026-01-10_follow-up.md"
}

export interface VaultReadResult {
  success: boolean
  content?: string
  error?: string
}

export async function vaultRead(
  vaultPath: string,
  params: VaultReadParams,
): Promise<VaultReadResult> {
  try {
    const { filepath } = params

    if (!isValidVaultPath(vaultPath, filepath)) {
      return {
        success: false,
        error: 'Invalid path: directory traversal not allowed',
      }
    }

    const fullPath = join(vaultPath, filepath)
    const content = await readFile(fullPath, 'utf-8')

    return {
      success: true,
      content,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'

    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {
        success: false,
        error: `File not found: ${params.filepath}`,
      }
    }

    return {
      success: false,
      error: message,
    }
  }
}

function isValidVaultPath(vaultPath: string, filepath: string): boolean {
  const normalized = normalize(filepath)

  if (normalized.startsWith('..') || normalized.includes('../')) {
    return false
  }

  const vaultRoot = resolve(vaultPath)
  const resolvedPath = resolve(vaultPath, normalized)

  return resolvedPath.startsWith(`${vaultRoot}/`) || resolvedPath === vaultRoot
}
