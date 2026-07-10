$ErrorActionPreference = "Stop"

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = Join-Path (Get-Location) "backups"
New-Item -ItemType Directory -Force $backupDir | Out-Null
$backupFile = Join-Path $backupDir "rack-manager-$timestamp.sql"

docker compose exec -T postgres pg_dump -U rackadmin -d rack_manager | Out-File -FilePath $backupFile -Encoding utf8
Write-Host "Backup saved to $backupFile"
