import { tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import {
  FIELD_DELIMITER,
  RECORD_DELIMITER,
  escapeAppleScriptString,
  executeAppleScript,
} from './applescript.js'

export interface Contact {
  id: string
  name: string
  emails: string[]
  phones: string[]
  organization?: string
  birthday?: string
}

export class ContactsManager {
  async searchContacts(query: string): Promise<Contact[] | null> {
    const escapedQuery = escapeAppleScriptString(query)
    const script = `
      tell application "Contacts"
        set searchResults to ""
        repeat with p in people
          if (name of p contains "${escapedQuery}") or (organization of p contains "${escapedQuery}") then
            if searchResults is not "" then
              set searchResults to searchResults & "${RECORD_DELIMITER}"
            end if
            set contactInfo to (id of p) & "${FIELD_DELIMITER}" & (name of p) & "${FIELD_DELIMITER}"
            set emailList to ""
            repeat with e in emails of p
              if emailList is not "" then
                set emailList to emailList & ","
              end if
              set emailList to emailList & (value of e)
            end repeat
            set contactInfo to contactInfo & emailList & "${FIELD_DELIMITER}"
            set phoneList to ""
            repeat with ph in phones of p
              if phoneList is not "" then
                set phoneList to phoneList & ","
              end if
              set phoneList to phoneList & (value of ph)
            end repeat
            set contactInfo to contactInfo & phoneList & "${FIELD_DELIMITER}" & (organization of p) & "${FIELD_DELIMITER}"
            try
              set birthdayValue to birth date of p
              set contactInfo to contactInfo & (birthdayValue as string)
            on error
              set contactInfo to contactInfo & ""
            end try
            set searchResults to searchResults & contactInfo
          end if
        end repeat
        return searchResults
      end tell
    `
    const result = await executeAppleScript(script)
    if (result) {
      const contactStrings = result.split(RECORD_DELIMITER)
      const contacts: Contact[] = contactStrings.map((contactStr) => {
        const [id, name, emailsStr, phonesStr, organization, birthday] =
          contactStr.split(FIELD_DELIMITER)
        return {
          id,
          name,
          emails: emailsStr ? emailsStr.split(',') : [],
          phones: phonesStr ? phonesStr.split(',') : [],
          organization: organization || undefined,
          birthday: birthday || undefined,
        } as Contact
      })
      return contacts
    }
    return null
  }

  async createContact(
    name: string,
    email?: string,
    phone?: string,
    organization?: string,
    birthday?: string,
  ): Promise<string | null> {
    const escapedName = escapeAppleScriptString(name)
    const escapedOrg = organization ? escapeAppleScriptString(organization) : ''
    const escapedEmail = email ? escapeAppleScriptString(email) : ''
    const escapedPhone = phone ? escapeAppleScriptString(phone) : ''
    const escapedBirthday = birthday ? escapeAppleScriptString(birthday) : ''

    const script = `
      tell application "Contacts"
        set newPerson to make new person with properties {name:"${escapedName}"${escapedOrg ? `, organization:"${escapedOrg}"` : ''}}
        ${escapedEmail ? `make new email at end of emails of newPerson with properties {value:"${escapedEmail}"}` : ''}
        ${escapedPhone ? `make new phone at end of phones of newPerson with properties {value:"${escapedPhone}"}` : ''}
        ${escapedBirthday ? `set birth date of newPerson to date "${escapedBirthday}"` : ''}
        save
        return "Contact created: ${escapedName}"
      end tell
    `
    return executeAppleScript(script)
  }

  async listContacts(): Promise<Contact[] | null> {
    const script = `
      tell application "Contacts"
        set contactList to ""
        repeat with p in people
          if contactList is not "" then
            set contactList to contactList & "${RECORD_DELIMITER}"
          end if
          set contactInfo to (id of p) & "${FIELD_DELIMITER}" & (name of p) & "${FIELD_DELIMITER}"
          set emailList to ""
          repeat with e in emails of p
            if emailList is not "" then
              set emailList to emailList & ","
            end if
            set emailList to emailList & (value of e)
          end repeat
          set contactInfo to contactInfo & emailList & "${FIELD_DELIMITER}"
          set phoneList to ""
          repeat with ph in phones of p
            if phoneList is not "" then
              set phoneList to phoneList & ","
            end if
            set phoneList to phoneList & (value of ph)
          end repeat
          set contactInfo to contactInfo & phoneList & "${FIELD_DELIMITER}" & (organization of p) & "${FIELD_DELIMITER}"
          try
            set birthdayValue to birth date of p
            set contactInfo to contactInfo & (birthdayValue as string)
          on error
            set contactInfo to contactInfo & ""
          end try
          set contactList to contactList & contactInfo
        end repeat
        return contactList
      end tell
    `
    const result = await executeAppleScript(script)
    if (result) {
      const contactStrings = result.split(RECORD_DELIMITER)
      const contacts: Contact[] = contactStrings.map((contactStr) => {
        const [id, name, emailsStr, phonesStr, organization, birthday] =
          contactStr.split(FIELD_DELIMITER)
        return {
          id,
          name,
          emails: emailsStr ? emailsStr.split(',') : [],
          phones: phonesStr ? phonesStr.split(',') : [],
          organization: organization || undefined,
          birthday: birthday || undefined,
        } as Contact
      })
      return contacts
    }
    return null
  }

  async getContact(contactName: string): Promise<Contact | null> {
    const escapedName = escapeAppleScriptString(contactName)
    const script = `
      tell application "Contacts"
        repeat with p in people
          if name of p is "${escapedName}" then
            set contactInfo to (id of p) & "${FIELD_DELIMITER}" & (name of p) & "${FIELD_DELIMITER}"
            set emailList to ""
            repeat with e in emails of p
              if emailList is not "" then
                set emailList to emailList & ","
              end if
              set emailList to emailList & (value of e)
            end repeat
            set contactInfo to contactInfo & emailList & "${FIELD_DELIMITER}"
            set phoneList to ""
            repeat with ph in phones of p
              if phoneList is not "" then
                set phoneList to phoneList & ","
              end if
              set phoneList to phoneList & (value of ph)
            end repeat
            set contactInfo to contactInfo & phoneList & "${FIELD_DELIMITER}" & (organization of p) & "${FIELD_DELIMITER}"
            try
              set birthdayValue to birth date of p
              set contactInfo to contactInfo & (birthdayValue as string)
            on error
              set contactInfo to contactInfo & ""
            end try
            return contactInfo
          end if
        end repeat
        return "Contact not found: ${escapedName}"
      end tell
    `
    const result = await executeAppleScript(script)
    if (result && !result.includes('Contact not found')) {
      const [id, name, emailsStr, phonesStr, organization, birthday] = result.split(FIELD_DELIMITER)
      return {
        id,
        name,
        emails: emailsStr ? emailsStr.split(',') : [],
        phones: phonesStr ? phonesStr.split(',') : [],
        organization: organization || undefined,
        birthday: birthday || undefined,
      } as Contact
    }
    return null
  }
}

// Singleton instance
const contactsManager = new ContactsManager()

// Tool definitions
export const searchContactsTool = tool(
  'apple_contacts_search',
  'Search contacts in Apple Contacts by name or organization',
  {
    query: z.string().describe('Search query to find contacts by name or organization'),
  },
  async (args) => {
    const result = await contactsManager.searchContacts(args.query)
    if (!result) {
      return {
        content: [{ type: 'text', text: 'Error: Could not search contacts' }],
        isError: true,
      }
    }
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    }
  },
)

export const createContactTool = tool(
  'apple_contacts_create',
  'Create a new contact in Apple Contacts',
  {
    name: z.string().describe('Name of the new contact'),
    email: z.string().optional().describe('Email address of the contact'),
    phone: z.string().optional().describe('Phone number of the contact'),
    organization: z.string().optional().describe('Organization of the contact'),
    birthday: z.string().optional().describe("Birthday of the contact (e.g., 'January 15, 1990')"),
  },
  async (args) => {
    const result = await contactsManager.createContact(
      args.name,
      args.email,
      args.phone,
      args.organization,
      args.birthday,
    )
    if (!result) {
      return {
        content: [{ type: 'text', text: 'Error: Could not create contact' }],
        isError: true,
      }
    }
    return {
      content: [{ type: 'text', text: result }],
    }
  },
)

export const listContactsTool = tool(
  'apple_contacts_list',
  'List all contacts in Apple Contacts',
  {},
  async () => {
    const result = await contactsManager.listContacts()
    if (!result) {
      return {
        content: [{ type: 'text', text: 'Error: Could not list contacts' }],
        isError: true,
      }
    }
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    }
  },
)

export const getContactTool = tool(
  'apple_contacts_get',
  'Get a specific contact by name from Apple Contacts',
  {
    contactName: z.string().describe('Name of the contact to retrieve'),
  },
  async (args) => {
    const result = await contactsManager.getContact(args.contactName)
    if (!result) {
      return {
        content: [{ type: 'text', text: 'Error: Contact not found' }],
        isError: true,
      }
    }
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    }
  },
)

export const contactsTools = [
  searchContactsTool,
  createContactTool,
  listContactsTool,
  getContactTool,
]
