import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { formatMarkdownForSlack } from '../slack/formatter.js'

describe('formatMarkdownForSlack', () => {
  it('returns empty string for empty input', () => {
    assert.strictEqual(formatMarkdownForSlack(''), '')
  })

  it('returns null/undefined as-is', () => {
    assert.strictEqual(formatMarkdownForSlack(null as unknown as string), null)
    assert.strictEqual(formatMarkdownForSlack(undefined as unknown as string), undefined)
  })

  describe('bold conversion', () => {
    it('converts **bold** to *bold*', () => {
      assert.strictEqual(formatMarkdownForSlack('This is **bold** text'), 'This is *bold* text')
    })

    it('handles multiple bold sections', () => {
      assert.strictEqual(formatMarkdownForSlack('**one** and **two**'), '*one* and *two*')
    })
  })

  describe('italic conversion', () => {
    it('converts *italic* to _italic_', () => {
      assert.strictEqual(formatMarkdownForSlack('This is *italic* text'), 'This is _italic_ text')
    })

    it('handles multiple italic sections', () => {
      assert.strictEqual(formatMarkdownForSlack('*one* and *two*'), '_one_ and _two_')
    })
  })

  describe('strikethrough conversion', () => {
    it('converts ~~strike~~ to ~strike~', () => {
      assert.strictEqual(formatMarkdownForSlack('This is ~~deleted~~ text'), 'This is ~deleted~ text')
    })
  })

  describe('link conversion', () => {
    it('converts [text](url) to <url|text>', () => {
      assert.strictEqual(
        formatMarkdownForSlack('Check [this link](https://example.com)'),
        'Check <https://example.com|this link>',
      )
    })

    it('handles multiple links', () => {
      assert.strictEqual(
        formatMarkdownForSlack('[one](http://1.com) and [two](http://2.com)'),
        '<http://1.com|one> and <http://2.com|two>',
      )
    })
  })

  describe('header conversion', () => {
    it('converts # header to *header*', () => {
      assert.strictEqual(formatMarkdownForSlack('# Main Title'), '*Main Title*')
    })

    it('converts ## header to *header*', () => {
      assert.strictEqual(formatMarkdownForSlack('## Section'), '*Section*')
    })

    it('converts ### header to *header*', () => {
      assert.strictEqual(formatMarkdownForSlack('### Subsection'), '*Subsection*')
    })

    it('handles headers in multiline text', () => {
      const input = `# Title

Some content

## Section`
      const expected = `*Title*

Some content

*Section*`
      assert.strictEqual(formatMarkdownForSlack(input), expected)
    })
  })

  describe('code preservation', () => {
    it('preserves inline code', () => {
      assert.strictEqual(formatMarkdownForSlack('Use `**bold**` syntax'), 'Use `**bold**` syntax')
    })

    it('preserves code blocks', () => {
      const input = `Here's code:
\`\`\`
**not bold**
*not italic*
\`\`\`
End`
      assert.strictEqual(formatMarkdownForSlack(input), input)
    })

    it('preserves code blocks with language', () => {
      const input = `\`\`\`typescript
const x = **test**;
\`\`\``
      assert.strictEqual(formatMarkdownForSlack(input), input)
    })
  })

  describe('table conversion', () => {
    it('wraps simple table in code block', () => {
      const input = `| Name | Value |
| ---- | ----- |
| foo  | 123   |`

      const expected = `\`\`\`
| Name | Value |
| ---- | ----- |
| foo  | 123   |
\`\`\``

      assert.strictEqual(formatMarkdownForSlack(input), expected)
    })

    it('handles table with surrounding text', () => {
      const input = `Here's a table:

| Col1 | Col2 |
| ---- | ---- |
| a    | b    |

And more text.`

      const expected = `Here's a table:

\`\`\`
| Col1 | Col2 |
| ---- | ---- |
| a    | b    |
\`\`\`

And more text.`

      assert.strictEqual(formatMarkdownForSlack(input), expected)
    })

    it('does not double-wrap tables already in code blocks', () => {
      const input = `\`\`\`
| Name | Value |
| ---- | ----- |
| foo  | 123   |
\`\`\``

      assert.strictEqual(formatMarkdownForSlack(input), input)
    })

    it('handles multiple tables', () => {
      const input = `| A | B |
| - | - |
| 1 | 2 |

Some text

| C | D |
| - | - |
| 3 | 4 |`

      const expected = `\`\`\`
| A | B |
| - | - |
| 1 | 2 |
\`\`\`

Some text

\`\`\`
| C | D |
| - | - |
| 3 | 4 |
\`\`\``

      assert.strictEqual(formatMarkdownForSlack(input), expected)
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

      assert.strictEqual(formatMarkdownForSlack(input), expected)
    })
  })
})
