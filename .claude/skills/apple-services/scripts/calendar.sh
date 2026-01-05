#!/bin/bash
# Apple Calendar management script
# Usage: calendar.sh <action> [args...]

set -e
SCRIPT_DIR="$(dirname "$0")"
source "$SCRIPT_DIR/_common.sh"

# List all available calendars
do_list() {
  local script='tell application "Calendar"
    set calendarList to {}
    repeat with c in calendars
      set end of calendarList to name of c
    end repeat
    return calendarList
  end tell'

  local result
  result=$(run_applescript "$script")
  if [ $? -ne 0 ] || [ -z "$result" ]; then
    output_error "Could not list calendars"
  fi

  # Convert comma-separated list to JSON array
  echo "$result" | awk -F', ' '{
    printf "[\n"
    for(i=1; i<=NF; i++) {
      gsub(/^[ \t]+|[ \t]+$/, "", $i)
      gsub(/"/, "\\\"", $i)
      printf "  \"%s\"", $i
      if(i<NF) printf ","
      printf "\n"
    }
    printf "]\n"
  }'
}

# List events from a calendar
# Args: [calendar] [days]
do_events() {
  local calendar="${1:-$DEFAULT_CALENDAR}"
  local days="${2:-7}"
  local escaped_calendar
  escaped_calendar=$(escape_applescript "$calendar")

  local script="tell application \"Calendar\"
    set startDate to (current date)
    set targetDate to startDate + ($days * days)
    set eventList to \"\"
    tell calendar \"$escaped_calendar\"
      set filteredEvents to (events whose start date >= startDate and start date <= targetDate)
      repeat with e in filteredEvents
        if eventList is not \"\" then
          set eventList to eventList & \"$RECORD_DELIMITER\"
        end if
        set eventList to eventList & (summary of e) & \"$FIELD_DELIMITER\" & (start date of e as string) & \"$FIELD_DELIMITER\" & (end date of e as string) & \"$FIELD_DELIMITER\" & \"$escaped_calendar\"
      end repeat
    end tell
    return eventList
  end tell"

  local result
  result=$(run_applescript "$script")
  if [ $? -ne 0 ]; then
    output_error "Could not list events"
  fi

  if [ -z "$result" ]; then
    echo "[]"
    return
  fi

  # Parse delimited output to JSON
  echo "$result" | awk -F"$FIELD_DELIMITER" -v RS="$RECORD_DELIMITER" '
  BEGIN { printf "[\n" }
  NR > 1 { printf ",\n" }
  {
    gsub(/^[ \t\n]+|[ \t\n]+$/, "", $1)
    gsub(/^[ \t\n]+|[ \t\n]+$/, "", $2)
    gsub(/^[ \t\n]+|[ \t\n]+$/, "", $3)
    gsub(/^[ \t\n]+|[ \t\n]+$/, "", $4)
    gsub(/"/, "\\\"", $1)
    gsub(/"/, "\\\"", $2)
    gsub(/"/, "\\\"", $3)
    gsub(/"/, "\\\"", $4)
    printf "  {\"summary\": \"%s\", \"startDate\": \"%s\", \"endDate\": \"%s\", \"calendar\": \"%s\"}", $1, $2, $3, $4
  }
  END { printf "\n]\n" }
  '
}

# Search events by query
# Args: <query> [calendar] [days]
do_search() {
  local query="$1"
  local calendar="${2:-$DEFAULT_CALENDAR}"
  local days="${3:-90}"

  if [ -z "$query" ]; then
    output_error "Usage: calendar.sh search <query> [calendar] [days]"
  fi

  local escaped_calendar escaped_query
  escaped_calendar=$(escape_applescript "$calendar")
  escaped_query=$(escape_applescript "$query")

  local script="tell application \"Calendar\"
    set searchResults to \"\"
    set startDate to (current date)
    set endDate to startDate + ($days * days)
    tell calendar \"$escaped_calendar\"
      set filteredEvents to (events whose start date >= startDate and start date <= endDate)
      repeat with e in filteredEvents
        if (summary of e contains \"$escaped_query\") or (description of e contains \"$escaped_query\") then
          if searchResults is not \"\" then
            set searchResults to searchResults & \"$RECORD_DELIMITER\"
          end if
          set searchResults to searchResults & (summary of e) & \"$FIELD_DELIMITER\" & (start date of e as string) & \"$FIELD_DELIMITER\" & (end date of e as string) & \"$FIELD_DELIMITER\" & \"$escaped_calendar\"
        end if
      end repeat
    end tell
    return searchResults
  end tell"

  local result
  result=$(run_applescript "$script")
  if [ $? -ne 0 ]; then
    output_error "Could not search events"
  fi

  if [ -z "$result" ]; then
    echo "[]"
    return
  fi

  # Parse delimited output to JSON
  echo "$result" | awk -F"$FIELD_DELIMITER" -v RS="$RECORD_DELIMITER" '
  BEGIN { printf "[\n" }
  NR > 1 { printf ",\n" }
  {
    gsub(/^[ \t\n]+|[ \t\n]+$/, "", $1)
    gsub(/^[ \t\n]+|[ \t\n]+$/, "", $2)
    gsub(/^[ \t\n]+|[ \t\n]+$/, "", $3)
    gsub(/^[ \t\n]+|[ \t\n]+$/, "", $4)
    gsub(/"/, "\\\"", $1)
    gsub(/"/, "\\\"", $2)
    gsub(/"/, "\\\"", $3)
    gsub(/"/, "\\\"", $4)
    printf "  {\"summary\": \"%s\", \"startDate\": \"%s\", \"endDate\": \"%s\", \"calendar\": \"%s\"}", $1, $2, $3, $4
  }
  END { printf "\n]\n" }
  '
}

# Create a new event
# Args: <calendar> <title> <start> <end> [description]
do_create() {
  local calendar="$1"
  local title="$2"
  local start_date="$3"
  local end_date="$4"
  local description="${5:-}"

  if [ -z "$calendar" ] || [ -z "$title" ] || [ -z "$start_date" ] || [ -z "$end_date" ]; then
    output_error "Usage: calendar.sh create <calendar> <title> <start> <end> [description]"
  fi

  local escaped_calendar escaped_title escaped_description
  escaped_calendar=$(escape_applescript "$calendar")
  escaped_title=$(escape_applescript "$title")
  escaped_description=$(escape_applescript "$description")

  local script="tell application \"Calendar\"
    tell calendar \"$escaped_calendar\"
      set newEvent to make new event with properties {summary:\"$escaped_title\", start date:date \"$start_date\", end date:date \"$end_date\", description:\"$escaped_description\"}
      return \"Event created: $escaped_title\"
    end tell
  end tell"

  local result
  result=$(run_applescript "$script")
  if [ $? -ne 0 ] || [ -z "$result" ]; then
    output_error "Could not create event"
  fi

  echo "{\"message\": \"$result\"}"
}

# Delete an event by title
# Args: <calendar> <title>
do_delete() {
  local calendar="$1"
  local title="$2"

  if [ -z "$calendar" ] || [ -z "$title" ]; then
    output_error "Usage: calendar.sh delete <calendar> <title>"
  fi

  local escaped_calendar escaped_title
  escaped_calendar=$(escape_applescript "$calendar")
  escaped_title=$(escape_applescript "$title")

  local script="tell application \"Calendar\"
    tell calendar \"$escaped_calendar\"
      set deleted to false
      repeat with e in events
        if summary of e is \"$escaped_title\" then
          delete e
          set deleted to true
          exit repeat
        end if
      end repeat
      if deleted then
        return \"Event deleted: $escaped_title\"
      else
        return \"Event not found: $escaped_title\"
      end if
    end tell
  end tell"

  local result
  result=$(run_applescript "$script")
  if [ $? -ne 0 ] || [ -z "$result" ]; then
    output_error "Could not delete event"
  fi

  echo "{\"message\": \"$result\"}"
}

# Get today's events
do_today() {
  do_events "$DEFAULT_CALENDAR" 1
}

# Get detailed event information
# Args: <calendar> <title>
do_details() {
  local calendar="$1"
  local title="$2"

  if [ -z "$calendar" ] || [ -z "$title" ]; then
    output_error "Usage: calendar.sh details <calendar> <title>"
  fi

  local escaped_calendar escaped_title
  escaped_calendar=$(escape_applescript "$calendar")
  escaped_title=$(escape_applescript "$title")

  local script="tell application \"Calendar\"
    tell calendar \"$escaped_calendar\"
      repeat with e in events
        if summary of e is \"$escaped_title\" then
          return (summary of e) & \"$FIELD_DELIMITER\" & (start date of e as string) & \"$FIELD_DELIMITER\" & (end date of e as string) & \"$FIELD_DELIMITER\" & \"$escaped_calendar\" & \"$FIELD_DELIMITER\" & (description of e) & \"$FIELD_DELIMITER\" & (location of e) & \"$FIELD_DELIMITER\" & (url of e)
        end if
      end repeat
      return \"\"
    end tell
  end tell"

  local result
  result=$(run_applescript "$script")
  if [ $? -ne 0 ]; then
    output_error "Could not get event details"
  fi

  if [ -z "$result" ]; then
    output_error "Event not found: $title"
  fi

  # Parse fields to JSON
  echo "$result" | awk -F"$FIELD_DELIMITER" '{
    gsub(/"/, "\\\"", $1)
    gsub(/"/, "\\\"", $2)
    gsub(/"/, "\\\"", $3)
    gsub(/"/, "\\\"", $4)
    gsub(/"/, "\\\"", $5)
    gsub(/"/, "\\\"", $6)
    gsub(/"/, "\\\"", $7)
    printf "{\n"
    printf "  \"summary\": \"%s\",\n", $1
    printf "  \"startDate\": \"%s\",\n", $2
    printf "  \"endDate\": \"%s\",\n", $3
    printf "  \"calendar\": \"%s\",\n", $4
    printf "  \"description\": \"%s\",\n", $5
    printf "  \"location\": \"%s\",\n", $6
    printf "  \"url\": \"%s\"\n", $7
    printf "}\n"
  }'
}

# Show usage
show_usage() {
  echo "Usage: calendar.sh <action> [args...]"
  echo ""
  echo "Actions:"
  echo "  list                              List all calendars"
  echo "  events [calendar] [days]          List upcoming events"
  echo "  search <query> [calendar] [days]  Search events"
  echo "  create <cal> <title> <start> <end> [desc]  Create event"
  echo "  delete <calendar> <title>         Delete event"
  echo "  today                             Get today's events"
  echo "  details <calendar> <title>        Get event details"
  exit 1
}

# Main dispatch
ACTION="$1"
shift 2>/dev/null || true

case "$ACTION" in
  list)    do_list ;;
  events)  do_events "$@" ;;
  search)  do_search "$@" ;;
  create)  do_create "$@" ;;
  delete)  do_delete "$@" ;;
  today)   do_today ;;
  details) do_details "$@" ;;
  *)       show_usage ;;
esac
