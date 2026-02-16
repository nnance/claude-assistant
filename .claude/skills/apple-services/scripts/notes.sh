#!/bin/bash
# Apple Notes management script
# Usage: notes.sh <action> [args...]

set -e
SCRIPT_DIR="$(dirname "$0")"
source "$SCRIPT_DIR/_common.sh"

# Helper to parse note record to JSON
parse_note_to_json() {
  local record="$1"
  echo "$record" | awk -F"$FIELD_DELIMITER" '{
    gsub(/"/, "\\\"", $1)
    gsub(/"/, "\\\"", $2)
    gsub(/"/, "\\\"", $3)
    gsub(/\n/, "\\n", $3)
    gsub(/\r/, "", $3)
    printf "{\n"
    printf "  \"id\": \"%s\",\n", $1
    printf "  \"name\": \"%s\",\n", $2
    printf "  \"body\": \"%s\"\n", $3
    printf "}"
  }'
}

# Search notes by title or content
# Args: <query>
do_search() {
  local query="$1"
  if [ -z "$query" ]; then
    output_error "Usage: notes.sh search <query>"
  fi

  local escaped_query
  escaped_query=$(escape_applescript "$query")

  local script="tell application \"Notes\"
    set searchResults to \"\"
    repeat with n in notes
      if (name of n contains \"$escaped_query\") or (body of n contains \"$escaped_query\") then
        if searchResults is not \"\" then
          set searchResults to searchResults & \"$RECORD_DELIMITER\"
        end if
        set searchResults to searchResults & (id of n) & \"$FIELD_DELIMITER\" & (name of n) & \"$FIELD_DELIMITER\" & (body of n)
      end if
    end repeat
    return searchResults
  end tell"

  local result
  result=$(run_applescript "$script")
  if [ $? -ne 0 ]; then
    output_error "Could not search notes"
  fi

  if [ -z "$result" ]; then
    echo "[]"
    return
  fi

  # Parse to JSON array
  echo "["
  local first=true
  IFS="$RECORD_DELIMITER" read -ra records <<< "$result"
  for record in "${records[@]}"; do
    if [ "$first" = true ]; then
      first=false
    else
      echo ","
    fi
    parse_note_to_json "$record"
  done
  echo "]"
}

# Create a new note
# Args: <title> [body]
do_create() {
  local title="$1"
  local body="${2:-}"

  if [ -z "$title" ]; then
    output_error "Usage: notes.sh create <title> [body]"
  fi

  local escaped_title escaped_body
  escaped_title=$(escape_applescript "$title")
  escaped_body=$(escape_applescript "$body")

  local script="tell application \"Notes\"
    make new note with properties {name:\"$escaped_title\", body:\"$escaped_body\"}
    return \"Note created: $escaped_title\"
  end tell"

  local result
  result=$(run_applescript "$script")
  if [ $? -ne 0 ] || [ -z "$result" ]; then
    output_error "Could not create note"
  fi

  echo "{\"message\": \"$result\"}"
}

# Edit an existing note
# Args: <title> <new_body>
do_edit() {
  local title="$1"
  local new_body="$2"

  if [ -z "$title" ] || [ -z "$new_body" ]; then
    output_error "Usage: notes.sh edit <title> <new_body>"
  fi

  local escaped_title escaped_body
  escaped_title=$(escape_applescript "$title")
  escaped_body=$(escape_applescript "$new_body")

  local script="tell application \"Notes\"
    repeat with n in notes
      if name of n is \"$escaped_title\" then
        set body of n to \"$escaped_body\"
        return \"Note updated: $escaped_title\"
      end if
    end repeat
    return \"Note not found: $escaped_title\"
  end tell"

  local result
  result=$(run_applescript "$script")
  if [ $? -ne 0 ] || [ -z "$result" ]; then
    output_error "Could not edit note"
  fi

  if [[ "$result" == *"not found"* ]]; then
    output_error "$result"
  fi

  echo "{\"message\": \"$result\"}"
}

# List all notes
do_list() {
  local script="tell application \"Notes\"
    set noteList to \"\"
    repeat with n in notes
      if noteList is not \"\" then
        set noteList to noteList & \"$RECORD_DELIMITER\"
      end if
      set noteList to noteList & (id of n) & \"$FIELD_DELIMITER\" & (name of n) & \"$FIELD_DELIMITER\" & (body of n)
    end repeat
    return noteList
  end tell"

  local result
  result=$(run_applescript "$script")
  if [ $? -ne 0 ]; then
    output_error "Could not list notes"
  fi

  if [ -z "$result" ]; then
    echo "[]"
    return
  fi

  # Parse to JSON array
  echo "["
  local first=true
  IFS="$RECORD_DELIMITER" read -ra records <<< "$result"
  for record in "${records[@]}"; do
    if [ "$first" = true ]; then
      first=false
    else
      echo ","
    fi
    parse_note_to_json "$record"
  done
  echo "]"
}

# Get the content of a specific note
# Args: <title>
do_get() {
  local title="$1"
  if [ -z "$title" ]; then
    output_error "Usage: notes.sh get <title>"
  fi

  local escaped_title
  escaped_title=$(escape_applescript "$title")

  local script="tell application \"Notes\"
    repeat with n in notes
      if name of n is \"$escaped_title\" then
        return body of n
      end if
    end repeat
    return \"\"
  end tell"

  local result
  result=$(run_applescript "$script")
  if [ $? -ne 0 ]; then
    output_error "Could not get note"
  fi

  if [ -z "$result" ]; then
    output_error "Note not found: $title"
  fi

  # Return the body content as JSON
  local escaped_result
  escaped_result=$(echo "$result" | sed 's/"/\\"/g' | tr '\n' ' ')
  echo "{\"content\": \"$escaped_result\"}"
}

# Show usage
show_usage() {
  echo "Usage: notes.sh <action> [args...]"
  echo ""
  echo "Actions:"
  echo "  search <query>         Search notes by title or content"
  echo "  create <title> [body]  Create a new note"
  echo "  edit <title> <body>    Edit an existing note"
  echo "  list                   List all notes"
  echo "  get <title>            Get note content"
  exit 1
}

# Main dispatch
ACTION="$1"
shift 2>/dev/null || true

case "$ACTION" in
  search) do_search "$@" ;;
  create) do_create "$@" ;;
  edit)   do_edit "$@" ;;
  list)   do_list ;;
  get)    do_get "$@" ;;
  *)      show_usage ;;
esac
