param(
  [Parameter(Mandatory = $true)]
  [string]$BackupFile
)

$ErrorActionPreference = "Stop"

if (!(Test-Path -LiteralPath $BackupFile)) {
  throw "Backup file not found: $BackupFile"
}

Get-Content -LiteralPath $BackupFile -Raw | docker compose exec -T postgres psql -U rackadmin -d rack_manager
Write-Host "Restore completed from $BackupFile"
