#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: ./scripts/restore-db.sh backups/rack-manager-YYYYMMDD-HHMMSS.sql"
  exit 1
fi

docker compose exec -T postgres psql -U rackadmin -d rack_manager < "$1"
echo "Restore completed from $1"
