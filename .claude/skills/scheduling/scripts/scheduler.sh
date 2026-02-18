#!/bin/bash
set -euo pipefail

# Scheduler CLI - manages scheduled jobs in SQLite
# Usage: scheduler.sh <command> [args...]

DB_PATH="${PROACTIVE_SCHEDULER_DB_PATH:-./data/scheduler.db}"

json_error() {
  echo "{\"error\": \"$1\"}" >&2
  exit 1
}

# Ensure database exists
if [ ! -f "$DB_PATH" ]; then
  json_error "Scheduler database not found at $DB_PATH. Is proactive mode enabled?"
fi

command="${1:-}"
shift || true

case "$command" in
  list)
    filter="${1:-active}"
    if [ "$filter" = "all" ]; then
      sqlite3 -json "$DB_PATH" "SELECT * FROM scheduled_jobs ORDER BY next_run_at;"
    else
      sqlite3 -json "$DB_PATH" "SELECT * FROM scheduled_jobs WHERE status = 'active' ORDER BY next_run_at;"
    fi
    ;;

  create)
    name="${1:?Missing job name}"
    job_type="${2:?Missing job type (one_shot or recurring)}"
    schedule="${3:?Missing schedule (ISO timestamp or cron expression)}"
    prompt="${4:?Missing prompt}"

    if [ "$job_type" != "one_shot" ] && [ "$job_type" != "recurring" ]; then
      json_error "Invalid job_type: $job_type. Must be 'one_shot' or 'recurring'."
    fi

    id=$(uuidgen | tr '[:upper:]' '[:lower:]')
    now=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")

    # For one_shot, schedule IS the next_run_at
    # For recurring, we store the cron and use schedule as next_run_at initially
    next_run_at="$schedule"

    sqlite3 "$DB_PATH" "INSERT INTO scheduled_jobs (id, name, description, job_type, schedule, next_run_at, status, prompt, failure_count, created_at, updated_at) VALUES ('$id', '$(echo "$name" | sed "s/'/''/g")', NULL, '$job_type', '$(echo "$schedule" | sed "s/'/''/g")', '$(echo "$next_run_at" | sed "s/'/''/g")', 'active', '$(echo "$prompt" | sed "s/'/''/g")', 0, '$now', '$now');"

    sqlite3 -json "$DB_PATH" "SELECT * FROM scheduled_jobs WHERE id = '$id';"
    ;;

  get)
    id="${1:?Missing job ID}"
    result=$(sqlite3 -json "$DB_PATH" "SELECT * FROM scheduled_jobs WHERE id = '$(echo "$id" | sed "s/'/''/g")';")
    if [ "$result" = "[]" ]; then
      json_error "Job not found: $id"
    fi
    echo "$result"
    ;;

  pause)
    id="${1:?Missing job ID}"
    sqlite3 "$DB_PATH" "UPDATE scheduled_jobs SET status = 'paused', updated_at = '$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")' WHERE id = '$(echo "$id" | sed "s/'/''/g")' AND status = 'active';"
    changes=$(sqlite3 "$DB_PATH" "SELECT changes();")
    if [ "$changes" = "0" ]; then
      json_error "Job not found or not active: $id"
    fi
    sqlite3 -json "$DB_PATH" "SELECT * FROM scheduled_jobs WHERE id = '$(echo "$id" | sed "s/'/''/g")';"
    ;;

  resume)
    id="${1:?Missing job ID}"
    sqlite3 "$DB_PATH" "UPDATE scheduled_jobs SET status = 'active', updated_at = '$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")' WHERE id = '$(echo "$id" | sed "s/'/''/g")' AND status = 'paused';"
    changes=$(sqlite3 "$DB_PATH" "SELECT changes();")
    if [ "$changes" = "0" ]; then
      json_error "Job not found or not paused: $id"
    fi
    sqlite3 -json "$DB_PATH" "SELECT * FROM scheduled_jobs WHERE id = '$(echo "$id" | sed "s/'/''/g")';"
    ;;

  delete)
    id="${1:?Missing job ID}"
    sqlite3 "$DB_PATH" "DELETE FROM scheduled_jobs WHERE id = '$(echo "$id" | sed "s/'/''/g")';"
    changes=$(sqlite3 "$DB_PATH" "SELECT changes();")
    if [ "$changes" = "0" ]; then
      json_error "Job not found: $id"
    fi
    echo "{\"deleted\": true, \"id\": \"$id\"}"
    ;;

  *)
    json_error "Unknown command: $command. Available: list, create, get, pause, resume, delete"
    ;;
esac
