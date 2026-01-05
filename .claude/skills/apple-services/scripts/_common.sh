#!/bin/bash
# Common utilities for Apple services scripts

# Delimiters for parsing AppleScript output
RECORD_DELIMITER=":::"
FIELD_DELIMITER="|||"

# Default calendar name from environment or fallback
DEFAULT_CALENDAR="${APPLE_CALENDAR_NAME:-Calendar}"

# Escape a string for use in AppleScript
# Handles backslashes and double quotes
escape_applescript() {
  local str="$1"
  str="${str//\\/\\\\}"
  str="${str//\"/\\\"}"
  echo "$str"
}

# Output an error message as JSON and exit
output_error() {
  local message="$1"
  echo "{\"error\": \"$message\"}"
  exit 1
}

# Convert a comma-separated string to a JSON array
csv_to_json_array() {
  local csv="$1"
  if [ -z "$csv" ]; then
    echo "[]"
    return
  fi
  echo "$csv" | awk -F',' '{
    printf "["
    for(i=1; i<=NF; i++) {
      gsub(/^[ \t]+|[ \t]+$/, "", $i)
      gsub(/"/, "\\\"", $i)
      printf "\"%s\"", $i
      if(i<NF) printf ", "
    }
    printf "]"
  }'
}

# Execute AppleScript and return result
# Returns empty string on error (caller should check exit code)
run_applescript() {
  local script="$1"
  local result
  result=$(osascript -e "$script" 2>&1)
  local exit_code=$?
  if [ $exit_code -ne 0 ]; then
    echo ""
    return $exit_code
  fi
  echo "$result"
  return 0
}
