$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "common.ps1")

$environment = Read-LabEnvironment
$database = Assert-LabDatabaseTarget $environment
if (-not (Test-LabDatabase $database)) { throw "Cannot connect to echat_test; no backup was created." }
$destinationDirectory = [IO.Path]::GetFullPath((Join-Path $script:LabRepoRoot "backups"))
New-Item -ItemType Directory -Force -Path $destinationDirectory | Out-Null
$destination = Join-Path $destinationDirectory ("echat_test_{0}.dump" -f (Get-Date -Format "yyyyMMdd_HHmmss"))
$pgDump = Get-LabPostgresTool "pg_dump"
$originalEnvironment = Set-LabPostgresEnvironment $database
try {
  & $pgDump --format=custom --no-owner --no-acl --file $destination echat_test 2>$null
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $destination -PathType Leaf) -or (Get-Item -LiteralPath $destination).Length -eq 0) {
    Remove-Item -LiteralPath $destination -Force -ErrorAction SilentlyContinue
    throw "pg_dump failed; no usable eChat backup was produced."
  }
} finally { Restore-LabPostgresEnvironment $originalEnvironment }

$pgRestore = Get-LabPostgresTool "pg_restore"
& $pgRestore --list $destination 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) { Remove-Item -LiteralPath $destination -Force; throw "The generated backup failed its archive integrity check." }
Write-Output "Backup created: $destination"
