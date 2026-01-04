import { createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk'
import { calendarTools } from './calendar.js'
import { contactsTools } from './contacts.js'
import { notesTools } from './notes.js'

/**
 * Creates an MCP server with Apple service tools (Calendar, Contacts, Notes).
 * This server runs in-process with the SDK for better performance.
 */
export function createAppleServicesMcpServer() {
  return createSdkMcpServer({
    name: 'apple-services',
    version: '1.0.0',
    tools: [...calendarTools, ...contactsTools, ...notesTools],
  })
}

// Re-export individual tool arrays for flexibility
export { calendarTools } from './calendar.js'
export { contactsTools } from './contacts.js'
export { notesTools } from './notes.js'

// Re-export managers for direct usage or testing
export { CalendarManager } from './calendar.js'
export { ContactsManager } from './contacts.js'
export { NotesManager } from './notes.js'

// Re-export types
export type { CalendarEvent, EventDetail } from './calendar.js'
export type { Contact } from './contacts.js'
export type { Note } from './notes.js'
