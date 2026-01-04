import { exec } from 'node:child_process'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

/**
 * Execute an AppleScript command and return the result.
 * @param script - The AppleScript code to execute
 * @returns The stdout from the script, or null if an error occurred
 */
export async function executeAppleScript(script: string): Promise<string | null> {
  try {
    const { stdout, stderr } = await execAsync(`osascript -e '${script}'`)
    if (stderr) {
      console.error('AppleScript error:', stderr)
    }
    return stdout.trim()
  } catch (error: unknown) {
    console.error('Error executing AppleScript:', (error as Error).message)
    return null
  }
}

/**
 * Escape a string for use in AppleScript.
 * Handles quotes and backslashes that could break the script.
 */
export function escapeAppleScriptString(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

// Common delimiters used for parsing AppleScript output
export const RECORD_DELIMITER = ':::'
export const FIELD_DELIMITER = '|||'
