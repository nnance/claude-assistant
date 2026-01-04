/**
 * Transforms standard markdown to Slack mrkdwn format.
 *
 * Key differences:
 * - Bold: **text** → *text*
 * - Italic: *text* → _text_ (when not inside code)
 * - Strikethrough: ~~text~~ → ~text~
 * - Links: [text](url) → <url|text>
 * - Headers: # Header → *Header*
 */
export function formatMarkdownForSlack(text: string): string {
  if (!text) return text

  // Extract code blocks to protect them from transformation
  const codeBlocks: string[] = []
  let result = text.replace(/```[\s\S]*?```/g, (match) => {
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
