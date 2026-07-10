#!/usr/bin/env bash
set -euo pipefail

mkdir -p backups
backup_file="backups/rack-manager-$(date +%Y%m%d-%H%M%S).sql"

docker compose exec -T postgres pg_dump -U rackadmin -d rack_manager > "$backup_file"
echo "Backup saved to $backup_file"
