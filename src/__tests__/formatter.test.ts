import { describe, expect, it } from '@jest/globals'
import { formatMarkdownForSlack } from '../slack/formatter.js'

describe('formatMarkdownForSlack', () => {
  it('returns empty string for empty input', () => {
    expect(formatMarkdownForSlack('')).toBe('')
  })

  it('returns null/undefined as-is', () => {
    expect(formatMarkdownForSlack(null as unknown as string)).toBe(null)
    expect(formatMarkdownForSlack(undefined as unknown as string)).toBe(undefined)
  })

  describe('bold conversion', () => {
    it('converts **bold** to *bold*', () => {
      expect(formatMarkdownForSlack('This is **bold** text')).toBe('This is *bold* text')
    })

    it('handles multiple bold sections', () => {
      expect(formatMarkdownForSlack('**one** and **two**')).toBe('*one* and *two*')
    })
  })

  describe('italic conversion', () => {
    it('converts *italic* to _italic_', () => {
      expect(formatMarkdownForSlack('This is *italic* text')).toBe('This is _italic_ text')
    })

    it('handles multiple italic sections', () => {
      expect(formatMarkdownForSlack('*one* and *two*')).toBe('_one_ and _two_')
    })
  })

  describe('strikethrough conversion', () => {
    it('converts ~~strike~~ to ~strike~', () => {
      expect(formatMarkdownForSlack('This is ~~deleted~~ text')).toBe('This is ~deleted~ text')
    })
  })

  describe('link conversion', () => {
    it('converts [text](url) to <url|text>', () => {
      expect(formatMarkdownForSlack('Check [this link](https://example.com)')).toBe(
        'Check <https://example.com|this link>',
      )
    })

    it('handles multiple links', () => {
      expect(formatMarkdownForSlack('[one](http://1.com) and [two](http://2.com)')).toBe(
        '<http://1.com|one> and <http://2.com|two>',
      )
    })
  })

  describe('header conversion', () => {
    it('converts # header to *header*', () => {
      expect(formatMarkdownForSlack('# Main Title')).toBe('*Main Title*')
    })

    it('converts ## header to *header*', () => {
      expect(formatMarkdownForSlack('## Section')).toBe('*Section*')
    })

    it('converts ### header to *header*', () => {
      expect(formatMarkdownForSlack('### Subsection')).toBe('*Subsection*')
    })

    it('handles headers in multiline text', () => {
      const input = `# Title

Some content

## Section`
      const expected = `*Title*

Some content

*Section*`
      expect(formatMarkdownForSlack(input)).toBe(expected)
    })
  })

  describe('code preservation', () => {
    it('preserves inline code', () => {
      expect(formatMarkdownForSlack('Use `**bold**` syntax')).toBe('Use `**bold**` syntax')
    })

    it('preserves code blocks', () => {
      const input = `Here's code:
\`\`\`
**not bold**
*not italic*
\`\`\`
End`
      expect(formatMarkdownForSlack(input)).toBe(input)
    })

    it('preserves code blocks with language', () => {
      const input = `\`\`\`typescript
const x = **test**;
\`\`\``
      expect(formatMarkdownForSlack(input)).toBe(input)
    })
  })

  describe('combined formatting', () => {
    it('handles mixed formatting in one message', () => {
      const input = `# Hello

This is **bold** and *italic* with a [link](https://example.com).

~~deleted~~ and \`code\``

      const expected = `*Hello*

This is *bold* and _italic_ with a <https://example.com|link>.

~deleted~ and \`code\``

      expect(formatMarkdownForSlack(input)).toBe(expected)
    })
  })
})
