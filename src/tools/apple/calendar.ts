import { tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import {
  FIELD_DELIMITER,
  RECORD_DELIMITER,
  escapeAppleScriptString,
  executeAppleScript,
} from './applescript.js'

export interface CalendarEvent {
  summary: string
  startDate: string
  endDate: string
  calendar: string
}

export interface EventDetail extends CalendarEvent {
  description: string
  location: string
  url: string
}

// Default calendar name from environment
// biome-ignore lint/complexity/useLiteralKeys: TypeScript requires bracket notation for index signatures
const DEFAULT_CALENDAR_NAME = process.env['APPLE_CALENDAR_NAME'] || 'Calendar'

export class CalendarManager {
  async listCalendars(): Promise<string[] | null> {
    const script = `
      tell application "Calendar"
        set calendarList to {}
        repeat with c in calendars
          set end of calendarList to name of c
        end repeat
        return calendarList
      end tell
    `
    const result = await executeAppleScript(script)
    if (result) {
      return result.split(', ')
    }
    return null
  }

  async listEvents(
    calendarName = DEFAULT_CALENDAR_NAME,
    days = 7,
  ): Promise<CalendarEvent[] | null> {
    const escapedCalendar = escapeAppleScriptString(calendarName)
    const script = `
      tell application "Calendar"
        set startDate to (current date)
        set targetDate to startDate + (${days} * days)
        set eventList to ""
        tell calendar "${escapedCalendar}"
          set filteredEvents to (events whose start date ≥ startDate and start date ≤ targetDate)
          repeat with e in filteredEvents
            if eventList is not "" then
              set eventList to eventList & "${RECORD_DELIMITER}"
            end if
            set eventList to eventList & (summary of e) & "${FIELD_DELIMITER}" & (start date of e as string) & "${FIELD_DELIMITER}" & (end date of e as string) & "${FIELD_DELIMITER}" & "${escapedCalendar}"
          end repeat
        end tell
        return eventList
      end tell
    `
    const result = await executeAppleScript(script)
    if (result) {
      const eventStrings = result.split(RECORD_DELIMITER)
      const events: CalendarEvent[] = eventStrings.map((eventStr) => {
        const [summary, startDate, endDate, calendar] = eventStr.split(FIELD_DELIMITER)
        return { summary, startDate, endDate, calendar } as CalendarEvent
      })
      return events
    }
    return null
  }

  async searchEvents(
    query: string,
    calendarName = DEFAULT_CALENDAR_NAME,
    days = 90,
  ): Promise<CalendarEvent[] | null> {
    const escapedCalendar = escapeAppleScriptString(calendarName)
    const escapedQuery = escapeAppleScriptString(query)
    const script = `
      tell application "Calendar"
        set searchResults to ""
        set startDate to (current date)
        set endDate to startDate + (${days} * days)
        tell calendar "${escapedCalendar}"
          set filteredEvents to (events whose start date ≥ startDate and start date ≤ endDate)
          repeat with e in filteredEvents
            if (summary of e contains "${escapedQuery}") or (description of e contains "${escapedQuery}") then
              if searchResults is not "" then
                set searchResults to searchResults & "${RECORD_DELIMITER}"
              end if
              set searchResults to searchResults & (summary of e) & "${FIELD_DELIMITER}" & (start date of e as string) & "${FIELD_DELIMITER}" & (end date of e as string) & "${FIELD_DELIMITER}" & "${escapedCalendar}"
            end if
          end repeat
        end tell
        return searchResults
      end tell
    `
    const result = await executeAppleScript(script)
    if (result) {
      const eventStrings = result.split(RECORD_DELIMITER)
      const events: CalendarEvent[] = eventStrings.map((eventStr) => {
        const [summary, startDate, endDate, calendar] = eventStr.split(FIELD_DELIMITER)
        return { summary, startDate, endDate, calendar } as CalendarEvent
      })
      return events
    }
    return null
  }

  async createEvent(
    calendarName: string,
    title: string,
    startDate: string,
    endDate: string,
    description = '',
  ): Promise<string | null> {
    const escapedCalendar = escapeAppleScriptString(calendarName)
    const escapedTitle = escapeAppleScriptString(title)
    const escapedDescription = escapeAppleScriptString(description)
    const script = `
      tell application "Calendar"
        tell calendar "${escapedCalendar}"
          set newEvent to make new event with properties {summary:"${escapedTitle}", start date:date "${startDate}", end date:date "${endDate}", description:"${escapedDescription}"}
          return "Event created: ${escapedTitle}"
        end tell
      end tell
    `
    return executeAppleScript(script)
  }

  async deleteEvent(calendarName: string, eventTitle: string): Promise<string | null> {
    const escapedCalendar = escapeAppleScriptString(calendarName)
    const escapedTitle = escapeAppleScriptString(eventTitle)
    const script = `
      tell application "Calendar"
        tell calendar "${escapedCalendar}"
          set deleted to false
          repeat with e in events
            if summary of e is "${escapedTitle}" then
              delete e
              set deleted to true
              exit repeat
            end if
          end repeat
          if deleted then
            return "Event deleted: ${escapedTitle}"
          else
            return "Event not found: ${escapedTitle}"
          end if
        end tell
      end tell
    `
    return executeAppleScript(script)
  }

  async getTodayEvents(): Promise<CalendarEvent[] | null> {
    return this.listEvents(DEFAULT_CALENDAR_NAME, 1)
  }

  async getEventDetails(calendarName: string, eventTitle: string): Promise<EventDetail | null> {
    const escapedCalendar = escapeAppleScriptString(calendarName)
    const escapedTitle = escapeAppleScriptString(eventTitle)
    const script = `
      tell application "Calendar"
        tell calendar "${escapedCalendar}"
          repeat with e in events
            if summary of e is "${escapedTitle}" then
              return (summary of e) & "${FIELD_DELIMITER}" & (start date of e as string) & "${FIELD_DELIMITER}" & (end date of e as string) & "${FIELD_DELIMITER}" & "${escapedCalendar}" & "${FIELD_DELIMITER}" & (description of e) & "${FIELD_DELIMITER}" & (location of e) & "${FIELD_DELIMITER}" & (url of e)
            end if
          end repeat
          return ""
        end tell
      end tell
    `
    const result = await executeAppleScript(script)
    if (result) {
      const [summary, startDate, endDate, calendar, description, location, url] =
        result.split(FIELD_DELIMITER)
      return {
        summary,
        startDate,
        endDate,
        calendar,
        description,
        location,
        url,
      } as EventDetail
    }
    return null
  }
}

// Singleton instance
const calendarManager = new CalendarManager()

// Tool definitions
export const listCalendarsTool = tool(
  'apple_calendar_list_calendars',
  'List all available calendars in Apple Calendar',
  {},
  async () => {
    const result = await calendarManager.listCalendars()
    if (!result) {
      return {
        content: [{ type: 'text', text: 'Error: Could not list calendars' }],
        isError: true,
      }
    }
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    }
  },
)

export const listEventsTool = tool(
  'apple_calendar_list_events',
  'List upcoming events from a calendar within a specified number of days',
  {
    calendarName: z
      .string()
      .optional()
      .describe('Name of the calendar (defaults to configured calendar)'),
    days: z.number().optional().describe('Number of days to look ahead (defaults to 7)'),
  },
  async (args) => {
    const result = await calendarManager.listEvents(args.calendarName, args.days)
    if (!result) {
      return {
        content: [{ type: 'text', text: 'Error: Could not list events' }],
        isError: true,
      }
    }
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    }
  },
)

export const searchEventsTool = tool(
  'apple_calendar_search_events',
  'Search for events in a calendar by title or description',
  {
    query: z.string().describe('Search query to find events'),
    calendarName: z
      .string()
      .optional()
      .describe('Name of the calendar (defaults to configured calendar)'),
    days: z.number().optional().describe('Number of days to search ahead (defaults to 90)'),
  },
  async (args) => {
    const result = await calendarManager.searchEvents(args.query, args.calendarName, args.days)
    if (!result) {
      return {
        content: [{ type: 'text', text: 'Error: Could not search events' }],
        isError: true,
      }
    }
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    }
  },
)

export const createEventTool = tool(
  'apple_calendar_create_event',
  'Create a new event in Apple Calendar',
  {
    calendarName: z.string().describe('Name of the calendar to create the event in'),
    title: z.string().describe('Title/summary of the event'),
    startDate: z.string().describe('Start date of the event (format: MM/DD/YYYY HH:MM:SS)'),
    endDate: z.string().describe('End date of the event (format: MM/DD/YYYY HH:MM:SS)'),
    description: z.string().optional().describe('Optional description of the event'),
  },
  async (args) => {
    const result = await calendarManager.createEvent(
      args.calendarName,
      args.title,
      args.startDate,
      args.endDate,
      args.description,
    )
    if (!result) {
      return {
        content: [{ type: 'text', text: 'Error: Could not create event' }],
        isError: true,
      }
    }
    return {
      content: [{ type: 'text', text: result }],
    }
  },
)

export const deleteEventTool = tool(
  'apple_calendar_delete_event',
  'Delete an event from Apple Calendar by its title',
  {
    calendarName: z.string().describe('Name of the calendar containing the event'),
    eventTitle: z.string().describe('Title of the event to delete'),
  },
  async (args) => {
    const result = await calendarManager.deleteEvent(args.calendarName, args.eventTitle)
    if (!result) {
      return {
        content: [{ type: 'text', text: 'Error: Could not delete event' }],
        isError: true,
      }
    }
    return {
      content: [{ type: 'text', text: result }],
    }
  },
)

export const getTodayEventsTool = tool(
  'apple_calendar_today_events',
  'Get all events for today from the default calendar',
  {},
  async () => {
    const result = await calendarManager.getTodayEvents()
    if (!result) {
      return {
        content: [{ type: 'text', text: 'Error: Could not get today events' }],
        isError: true,
      }
    }
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    }
  },
)

export const getEventDetailsTool = tool(
  'apple_calendar_event_details',
  'Get detailed information about a specific event including description, location, and URL',
  {
    calendarName: z.string().describe('Name of the calendar containing the event'),
    eventTitle: z.string().describe('Title of the event to get details for'),
  },
  async (args) => {
    const result = await calendarManager.getEventDetails(args.calendarName, args.eventTitle)
    if (!result) {
      return {
        content: [{ type: 'text', text: 'Error: Event not found' }],
        isError: true,
      }
    }
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    }
  },
)

export const calendarTools = [
  listCalendarsTool,
  listEventsTool,
  searchEventsTool,
  createEventTool,
  deleteEventTool,
  getTodayEventsTool,
  getEventDetailsTool,
]
