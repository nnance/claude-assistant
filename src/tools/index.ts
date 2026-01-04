// Re-export Apple services tools
export {
  createAppleServicesMcpServer,
  calendarTools,
  contactsTools,
  notesTools,
  CalendarManager,
  ContactsManager,
  NotesManager,
} from './apple/index.js'

export type { CalendarEvent, EventDetail, Contact, Note } from './apple/index.js'
