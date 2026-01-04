import { tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import {
  FIELD_DELIMITER,
  RECORD_DELIMITER,
  escapeAppleScriptString,
  executeAppleScript,
} from './applescript.js'

export interface Note {
  id: string
  name: string
  body: string
}

export class NotesManager {
  async searchNotes(query: string): Promise<Note[] | null> {
    const escapedQuery = escapeAppleScriptString(query)
    const script = `
      tell application "Notes"
        set searchResults to ""
        repeat with n in notes
          if (name of n contains "${escapedQuery}") or (body of n contains "${escapedQuery}") then
            if searchResults is not "" then
              set searchResults to searchResults & "${RECORD_DELIMITER}"
            end if
            set searchResults to searchResults & (id of n) & "${FIELD_DELIMITER}" & (name of n) & "${FIELD_DELIMITER}" & (body of n)
          end if
        end repeat
        return searchResults
      end tell
    `
    const result = await executeAppleScript(script)
    if (result) {
      const noteStrings = result.split(RECORD_DELIMITER)
      const notes: Note[] = noteStrings.map((noteStr) => {
        const [id, name, body] = noteStr.split(FIELD_DELIMITER)
        return { id, name, body } as Note
      })
      return notes
    }
    return null
  }

  async createNote(title: string, body = ''): Promise<string | null> {
    const escapedTitle = escapeAppleScriptString(title)
    const escapedBody = escapeAppleScriptString(body)
    const script = `
      tell application "Notes"
        make new note with properties {name:"${escapedTitle}", body:"${escapedBody}"}
        return "Note created: ${escapedTitle}"
      end tell
    `
    return executeAppleScript(script)
  }

  async editNote(noteTitle: string, newBody: string): Promise<string | null> {
    const escapedTitle = escapeAppleScriptString(noteTitle)
    const escapedBody = escapeAppleScriptString(newBody)
    const script = `
      tell application "Notes"
        repeat with n in notes
          if name of n is "${escapedTitle}" then
            set body of n to "${escapedBody}"
            return "Note updated: ${escapedTitle}"
          end if
        end repeat
        return "Note not found: ${escapedTitle}"
      end tell
    `
    return executeAppleScript(script)
  }

  async listNotes(): Promise<Note[] | null> {
    const script = `
      tell application "Notes"
        set noteList to ""
        repeat with n in notes
          if noteList is not "" then
            set noteList to noteList & "${RECORD_DELIMITER}"
          end if
          set noteList to noteList & (id of n) & "${FIELD_DELIMITER}" & (name of n) & "${FIELD_DELIMITER}" & (body of n)
        end repeat
        return noteList
      end tell
    `
    const result = await executeAppleScript(script)
    if (result) {
      const noteStrings = result.split(RECORD_DELIMITER)
      const notes: Note[] = noteStrings.map((noteStr) => {
        const [id, name, body] = noteStr.split(FIELD_DELIMITER)
        return { id, name, body } as Note
      })
      return notes
    }
    return null
  }

  async getNoteContent(noteTitle: string): Promise<string | null> {
    const escapedTitle = escapeAppleScriptString(noteTitle)
    const script = `
      tell application "Notes"
        repeat with n in notes
          if name of n is "${escapedTitle}" then
            return body of n
          end if
        end repeat
        return "Note not found: ${escapedTitle}"
      end tell
    `
    return executeAppleScript(script)
  }
}

// Singleton instance
const notesManager = new NotesManager()

// Tool definitions
export const searchNotesTool = tool(
  'apple_notes_search',
  'Search notes in Apple Notes by title or content',
  {
    query: z.string().describe('Search query to find notes by title or content'),
  },
  async (args) => {
    const result = await notesManager.searchNotes(args.query)
    if (!result) {
      return {
        content: [{ type: 'text', text: 'Error: Could not search notes' }],
        isError: true,
      }
    }
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    }
  },
)

export const createNoteTool = tool(
  'apple_notes_create',
  'Create a new note in Apple Notes',
  {
    title: z.string().describe('Title of the new note'),
    body: z.string().optional().describe('Body content of the new note'),
  },
  async (args) => {
    const result = await notesManager.createNote(args.title, args.body)
    if (!result) {
      return {
        content: [{ type: 'text', text: 'Error: Could not create note' }],
        isError: true,
      }
    }
    return {
      content: [{ type: 'text', text: result }],
    }
  },
)

export const editNoteTool = tool(
  'apple_notes_edit',
  'Edit an existing note in Apple Notes',
  {
    noteTitle: z.string().describe('Title of the note to edit'),
    newBody: z.string().describe('New body content for the note'),
  },
  async (args) => {
    const result = await notesManager.editNote(args.noteTitle, args.newBody)
    if (!result) {
      return {
        content: [{ type: 'text', text: 'Error: Could not edit note' }],
        isError: true,
      }
    }
    return {
      content: [{ type: 'text', text: result }],
    }
  },
)

export const listNotesTool = tool(
  'apple_notes_list',
  'List all notes in Apple Notes',
  {},
  async () => {
    const result = await notesManager.listNotes()
    if (!result) {
      return {
        content: [{ type: 'text', text: 'Error: Could not list notes' }],
        isError: true,
      }
    }
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    }
  },
)

export const getNoteContentTool = tool(
  'apple_notes_get_content',
  'Get the content of a specific note by its title',
  {
    noteTitle: z.string().describe('Title of the note to retrieve'),
  },
  async (args) => {
    const result = await notesManager.getNoteContent(args.noteTitle)
    if (!result || result.includes('Note not found')) {
      return {
        content: [{ type: 'text', text: 'Error: Note not found' }],
        isError: true,
      }
    }
    return {
      content: [{ type: 'text', text: result }],
    }
  },
)

export const notesTools = [
  searchNotesTool,
  createNoteTool,
  editNoteTool,
  listNotesTool,
  getNoteContentTool,
]
