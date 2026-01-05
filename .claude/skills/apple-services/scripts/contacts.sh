#!/bin/bash
# Apple Contacts management script
# Usage: contacts.sh <action> [args...]

set -e
SCRIPT_DIR="$(dirname "$0")"
source "$SCRIPT_DIR/_common.sh"

# Helper to parse contact record to JSON
parse_contact_to_json() {
  local record="$1"
  echo "$record" | awk -F"$FIELD_DELIMITER" '{
    gsub(/"/, "\\\"", $1)
    gsub(/"/, "\\\"", $2)
    gsub(/"/, "\\\"", $5)
    gsub(/"/, "\\\"", $6)

    # Parse emails (comma-separated)
    n_emails = split($3, emails, ",")
    email_json = "["
    for(i=1; i<=n_emails; i++) {
      gsub(/^[ \t]+|[ \t]+$/, "", emails[i])
      gsub(/"/, "\\\"", emails[i])
      if(i>1) email_json = email_json ", "
      email_json = email_json "\"" emails[i] "\""
    }
    email_json = email_json "]"
    if($3 == "") email_json = "[]"

    # Parse phones (comma-separated)
    n_phones = split($4, phones, ",")
    phone_json = "["
    for(i=1; i<=n_phones; i++) {
      gsub(/^[ \t]+|[ \t]+$/, "", phones[i])
      gsub(/"/, "\\\"", phones[i])
      if(i>1) phone_json = phone_json ", "
      phone_json = phone_json "\"" phones[i] "\""
    }
    phone_json = phone_json "]"
    if($4 == "") phone_json = "[]"

    printf "{\n"
    printf "  \"id\": \"%s\",\n", $1
    printf "  \"name\": \"%s\",\n", $2
    printf "  \"emails\": %s,\n", email_json
    printf "  \"phones\": %s", phone_json
    if($5 != "") printf ",\n  \"organization\": \"%s\"", $5
    if($6 != "") printf ",\n  \"birthday\": \"%s\"", $6
    printf "\n}"
  }'
}

# Search contacts by name or organization
# Args: <query>
do_search() {
  local query="$1"
  if [ -z "$query" ]; then
    output_error "Usage: contacts.sh search <query>"
  fi

  local escaped_query
  escaped_query=$(escape_applescript "$query")

  local script="tell application \"Contacts\"
    set searchResults to \"\"
    repeat with p in people
      if (name of p contains \"$escaped_query\") or (organization of p contains \"$escaped_query\") then
        if searchResults is not \"\" then
          set searchResults to searchResults & \"$RECORD_DELIMITER\"
        end if
        set contactInfo to (id of p) & \"$FIELD_DELIMITER\" & (name of p) & \"$FIELD_DELIMITER\"
        set emailList to \"\"
        repeat with e in emails of p
          if emailList is not \"\" then
            set emailList to emailList & \",\"
          end if
          set emailList to emailList & (value of e)
        end repeat
        set contactInfo to contactInfo & emailList & \"$FIELD_DELIMITER\"
        set phoneList to \"\"
        repeat with ph in phones of p
          if phoneList is not \"\" then
            set phoneList to phoneList & \",\"
          end if
          set phoneList to phoneList & (value of ph)
        end repeat
        set contactInfo to contactInfo & phoneList & \"$FIELD_DELIMITER\" & (organization of p) & \"$FIELD_DELIMITER\"
        try
          set birthdayValue to birth date of p
          set contactInfo to contactInfo & (birthdayValue as string)
        on error
          set contactInfo to contactInfo & \"\"
        end try
        set searchResults to searchResults & contactInfo
      end if
    end repeat
    return searchResults
  end tell"

  local result
  result=$(run_applescript "$script")
  if [ $? -ne 0 ]; then
    output_error "Could not search contacts"
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
    parse_contact_to_json "$record"
  done
  echo "]"
}

# Create a new contact
# Args: <name> [email] [phone] [organization] [birthday]
do_create() {
  local name="$1"
  local email="${2:-}"
  local phone="${3:-}"
  local organization="${4:-}"
  local birthday="${5:-}"

  if [ -z "$name" ]; then
    output_error "Usage: contacts.sh create <name> [email] [phone] [organization] [birthday]"
  fi

  local escaped_name escaped_org escaped_email escaped_phone escaped_birthday
  escaped_name=$(escape_applescript "$name")
  escaped_org=$(escape_applescript "$organization")
  escaped_email=$(escape_applescript "$email")
  escaped_phone=$(escape_applescript "$phone")
  escaped_birthday=$(escape_applescript "$birthday")

  local org_prop=""
  if [ -n "$organization" ]; then
    org_prop=", organization:\"$escaped_org\""
  fi

  local email_cmd=""
  if [ -n "$email" ]; then
    email_cmd="make new email at end of emails of newPerson with properties {value:\"$escaped_email\"}"
  fi

  local phone_cmd=""
  if [ -n "$phone" ]; then
    phone_cmd="make new phone at end of phones of newPerson with properties {value:\"$escaped_phone\"}"
  fi

  local birthday_cmd=""
  if [ -n "$birthday" ]; then
    birthday_cmd="set birth date of newPerson to date \"$escaped_birthday\""
  fi

  local script="tell application \"Contacts\"
    set newPerson to make new person with properties {name:\"$escaped_name\"$org_prop}
    $email_cmd
    $phone_cmd
    $birthday_cmd
    save
    return \"Contact created: $escaped_name\"
  end tell"

  local result
  result=$(run_applescript "$script")
  if [ $? -ne 0 ] || [ -z "$result" ]; then
    output_error "Could not create contact"
  fi

  echo "{\"message\": \"$result\"}"
}

# List all contacts
do_list() {
  local script="tell application \"Contacts\"
    set contactList to \"\"
    repeat with p in people
      if contactList is not \"\" then
        set contactList to contactList & \"$RECORD_DELIMITER\"
      end if
      set contactInfo to (id of p) & \"$FIELD_DELIMITER\" & (name of p) & \"$FIELD_DELIMITER\"
      set emailList to \"\"
      repeat with e in emails of p
        if emailList is not \"\" then
          set emailList to emailList & \",\"
        end if
        set emailList to emailList & (value of e)
      end repeat
      set contactInfo to contactInfo & emailList & \"$FIELD_DELIMITER\"
      set phoneList to \"\"
      repeat with ph in phones of p
        if phoneList is not \"\" then
          set phoneList to phoneList & \",\"
        end if
        set phoneList to phoneList & (value of ph)
      end repeat
      set contactInfo to contactInfo & phoneList & \"$FIELD_DELIMITER\" & (organization of p) & \"$FIELD_DELIMITER\"
      try
        set birthdayValue to birth date of p
        set contactInfo to contactInfo & (birthdayValue as string)
      on error
        set contactInfo to contactInfo & \"\"
      end try
      set contactList to contactList & contactInfo
    end repeat
    return contactList
  end tell"

  local result
  result=$(run_applescript "$script")
  if [ $? -ne 0 ]; then
    output_error "Could not list contacts"
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
    parse_contact_to_json "$record"
  done
  echo "]"
}

# Get a specific contact by name
# Args: <name>
do_get() {
  local name="$1"
  if [ -z "$name" ]; then
    output_error "Usage: contacts.sh get <name>"
  fi

  local escaped_name
  escaped_name=$(escape_applescript "$name")

  local script="tell application \"Contacts\"
    repeat with p in people
      if name of p is \"$escaped_name\" then
        set contactInfo to (id of p) & \"$FIELD_DELIMITER\" & (name of p) & \"$FIELD_DELIMITER\"
        set emailList to \"\"
        repeat with e in emails of p
          if emailList is not \"\" then
            set emailList to emailList & \",\"
          end if
          set emailList to emailList & (value of e)
        end repeat
        set contactInfo to contactInfo & emailList & \"$FIELD_DELIMITER\"
        set phoneList to \"\"
        repeat with ph in phones of p
          if phoneList is not \"\" then
            set phoneList to phoneList & \",\"
          end if
          set phoneList to phoneList & (value of ph)
        end repeat
        set contactInfo to contactInfo & phoneList & \"$FIELD_DELIMITER\" & (organization of p) & \"$FIELD_DELIMITER\"
        try
          set birthdayValue to birth date of p
          set contactInfo to contactInfo & (birthdayValue as string)
        on error
          set contactInfo to contactInfo & \"\"
        end try
        return contactInfo
      end if
    end repeat
    return \"\"
  end tell"

  local result
  result=$(run_applescript "$script")
  if [ $? -ne 0 ]; then
    output_error "Could not get contact"
  fi

  if [ -z "$result" ]; then
    output_error "Contact not found: $name"
  fi

  parse_contact_to_json "$result"
}

# Show usage
show_usage() {
  echo "Usage: contacts.sh <action> [args...]"
  echo ""
  echo "Actions:"
  echo "  search <query>                       Search contacts"
  echo "  create <name> [email] [phone] [org] [birthday]  Create contact"
  echo "  list                                 List all contacts"
  echo "  get <name>                           Get specific contact"
  exit 1
}

# Main dispatch
ACTION="$1"
shift 2>/dev/null || true

case "$ACTION" in
  search) do_search "$@" ;;
  create) do_create "$@" ;;
  list)   do_list ;;
  get)    do_get "$@" ;;
  *)      show_usage ;;
esac
