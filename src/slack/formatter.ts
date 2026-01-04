/**
 * Transforms standard markdown to Slack mrkdwn format.
 *
 * Key differences:
 * - Bold: **text** → *text*
 * - Italic: *text* → _text_ (when not inside code)
 * - Strikethrough: ~~text~~ → ~text~
 * - Links: [text](url) → <url|text>
 * - Headers: # Header → *Header*
 * - Tables: wrapped in code blocks for monospace alignment
 */
export function formatMarkdownForSlack(text: string): string {
  if (!text) return text

  // Convert markdown tables to code blocks (before extracting code blocks)
  // Match tables: lines starting with | and containing at least one |
  let result = convertTablesToCodeBlocks(text)

  // Extract code blocks to protect them from transformation
  const codeBlocks: string[] = []
  result = result.replace(/```[\s\S]*?```/g, (match) => {
    codeBlocks.push(match)
    return `__CODE_BLOCK_${codeBlocks.length - 1}__`
  })

  // Extract inline code to protect it from transformation
  const inlineCode: string[] = []
  result = result.replace(/`[^`]+`/g, (match) => {
    inlineCode.push(match)
    return `__INLINE_CODE_${inlineCode.length - 1}__`
  })

  // Convert links: [text](url) → <url|text>
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<$2|$1>')

  // Convert headers: # Header → *Header* (use placeholder to protect from italic conversion)
  const headers: string[] = []
  result = result.replace(/^#{1,6}\s+(.+)$/gm, (_match, p1) => {
    headers.push(p1)
    return `__HEADER_${headers.length - 1}__`
  })

  // Extract bold: **text** → placeholder (to protect from italic conversion)
  const boldPatterns: string[] = []
  result = result.replace(/\*\*([^*]+)\*\*/g, (_match, p1) => {
    boldPatterns.push(p1)
    return `__BOLD_${boldPatterns.length - 1}__`
  })

  // Convert italic: *text* → _text_ (single asterisk)
  result = result.replace(/\*([^*]+)\*/g, '_$1_')

  // Restore bold as *text*
  for (let i = 0; i < boldPatterns.length; i++) {
    result = result.replace(`__BOLD_${i}__`, `*${boldPatterns[i]}*`)
  }

  // Restore headers as *text*
  for (let i = 0; i < headers.length; i++) {
    result = result.replace(`__HEADER_${i}__`, `*${headers[i]}*`)
  }

  // Convert strikethrough: ~~text~~ → ~text~
  result = result.replace(/~~([^~]+)~~/g, '~$1~')

  // Restore inline code
  for (let i = 0; i < inlineCode.length; i++) {
    result = result.replace(`__INLINE_CODE_${i}__`, inlineCode[i] as string)
  }

  // Restore code blocks
  for (let i = 0; i < codeBlocks.length; i++) {
    result = result.replace(`__CODE_BLOCK_${i}__`, codeBlocks[i] as string)
  }

  return result
}

/**
 * Detects markdown tables and wraps them in code blocks for monospace rendering.
 * A table is identified by consecutive lines that start and end with |
 * Skips tables that are already inside code blocks.
 */
function convertTablesToCodeBlocks(text: string): string {
  const lines = text.split('\n')
  const result: string[] = []
  let tableLines: string[] = []
  let inTable = false
  let inCodeBlock = false

  for (const line of lines) {
    // Track code block boundaries
    if (/^```/.test(line)) {
      if (inTable) {
        // End table before code block starts
        result.push('```')
        result.push(...tableLines)
        result.push('```')
        tableLines = []
        inTable = false
      }
      inCodeBlock = !inCodeBlock
      result.push(line)
      continue
    }

    // Skip table detection inside code blocks
    if (inCodeBlock) {
      result.push(line)
      continue
    }

    const isTableLine = /^\s*\|.*\|\s*$/.test(line)

    if (isTableLine) {
      if (!inTable) {
        inTable = true
      }
      tableLines.push(line)
    } else {
      if (inTable) {
        // End of table - wrap collected lines in code block
        result.push('```')
        result.push(...tableLines)
        result.push('```')
        tableLines = []
        inTable = false
      }
      result.push(line)
    }
  }

  // Handle table at end of text
  if (inTable && tableLines.length > 0) {
    result.push('```')
    result.push(...tableLines)
    result.push('```')
  }

  return result.join('\n')
}
