param([Parameter(Mandatory=$true)][string]$BackupPath)
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "common.ps1")

$environment = Read-LabEnvironment
$database = Assert-LabDatabaseTarget $environment
$backupRoot = [IO.Path]::GetFullPath((Join-Path $script:LabRepoRoot "backups"))
$fullBackupPath = [IO.Path]::GetFullPath($BackupPath)
if (-not $fullBackupPath.StartsWith($backupRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw "Restore input must be an explicit file inside the ignored backups directory." }
if (-not (Test-Path -LiteralPath $fullBackupPath -PathType Leaf) -or [IO.Path]::GetExtension($fullBackupPath) -ne ".dump") { throw "Select an existing custom-format .dump backup." }
if (-not (Test-LabDatabase $database)) { throw "Cannot connect to echat_test; restore stopped." }
if ((Get-LabListener 3001).Count -gt 0 -and -not (Test-Path -LiteralPath (Get-LabProcessMarker "echat-api"))) { throw "An unmanaged eChat API is active; stop it manually before restoring." }

$confirmation = Read-Host "This replaces echat_test after an automatic backup. Type RESTORE echat_test"
if ($confirmation -cne "RESTORE echat_test") { throw "Restore cancelled; echat_test was not changed." }

$apiWasManaged = Test-Path -LiteralPath (Get-LabProcessMarker "echat-api")
if ($apiWasManaged) { $null = Stop-LabOwnedProcess "echat-api" }
try {
  $backupScript = Join-Path $PSScriptRoot "backup-echat.ps1"
  $currentBackup = & $backupScript
  $pgRestore = Get-LabPostgresTool "pg_restore"
  $originalEnvironment = Set-LabPostgresEnvironment $database
  try {
    & $pgRestore --exit-on-error --clean --if-exists --single-transaction --no-owner --no-acl --dbname echat_test $fullBackupPath 2>$null
    if ($LASTEXITCODE -ne 0) { throw "pg_restore failed; echat_test may require recovery from the automatic backup." }
  } finally { Restore-LabPostgresEnvironment $originalEnvironment }
  $migrationOutput = & npm run db:migrate 2>&1
  if ($LASTEXITCODE -ne 0) {
    $migrationOutput | ForEach-Object { if ($_ -notmatch "postgres://|postgresql://|password|token|secret|credential") { Write-Output $_ } }
    throw "Post-restore migrations failed for echat_test."
  }
  $requiredTables = @("organizations", "users", "organization_members", "contacts", "channels", "conversations", "messages", "contact_identities", "integration_accounts", "webhook_events", "auth_sessions", "organization_invites", "pipelines", "pipeline_stages", "opportunities", "opportunity_activities", "opportunity_conversations")
  $valuesSql = ($requiredTables | ForEach-Object { "('$_')" }) -join ","
  $readinessQuery = "SELECT CASE WHEN bool_and(to_regclass('public.' || table_name) IS NOT NULL) THEN 'READY' ELSE 'BLOCKED' END FROM (VALUES $valuesSql) AS required(table_name)"
  $readinessResult = Invoke-LabDatabaseQuery $database $readinessQuery
  if ($readinessResult -ne "READY") { throw "Post-restore schema readiness check failed for echat_test." }
  if ($apiWasManaged) { $null = Start-LabOwnedProcess "echat-api" "dev:api" 3001 "http://127.0.0.1:3001/api/health" }
  Write-Output "Restore complete: echat_test was restored from the selected archive and migrations/readiness setup completed."
  Write-Output "Automatic pre-restore backup: $currentBackup"
} finally {
  if ($apiWasManaged -and -not (Test-LabHttp "http://127.0.0.1:3001/api/health")) {
    try { $null = Start-LabOwnedProcess "echat-api" "dev:api" 3001 "http://127.0.0.1:3001/api/health" } catch { Write-Warning "The previously managed API could not be restarted; check scripts/lab/status-lab.ps1." }
  }
}
