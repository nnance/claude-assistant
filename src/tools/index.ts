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

// Re-export vault tools
export { createVaultMcpServer, createVaultTools } from './vault/index.js'
export type {
  VaultFolder,
  VaultWriteParams,
  VaultWriteResult,
  VaultReadParams,
  VaultReadResult,
  VaultListParams,
  VaultFileInfo,
  VaultListResult,
  LogInteractionParams,
  LogInteractionResult,
} from './vault/index.js'
export { vaultWrite, vaultRead, vaultList, logInteraction, generateSlug } from './vault/index.js'
